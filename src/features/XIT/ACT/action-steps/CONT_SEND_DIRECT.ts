import { act } from '@src/features/XIT/ACT/act-registry';
import { ddmm, fixed0, fixed02, fixed2 } from '@src/utils/format';
import { changeSelectIndex, selectAndChangeInputValue } from '@src/util';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';
import { isValidContractPrice } from '@src/features/XIT/ACT/actions/cont-limits';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import {
  createNewDraft,
  setDraftNameAndPreamble,
  saveDraftDetails,
  openTemplate,
  selectTemplateType,
  setCurrency,
  addMaterials,
  setDeadline,
  applyTemplate,
  saveConditions,
  setRecipient,
  sendToRecipient,
  deleteDraftFromList,
  findShipPriceInput,
  pollUntil,
} from '@src/features/XIT/ACT/action-steps/cont-utils';
import { billQuantities, MaterialBill } from '@src/features/XIT/ACT/material-bill';

interface TradeShape {
  kind: 'TRADE';
  tradeType: 'BUYING' | 'SELLING';
  location: string;
}

interface ShipShape {
  kind: 'SHIP';
  contOrigin: string;
  contDest: string;
  payment: number;
  autoProvisionStoreId?: string;
}

interface Data {
  packageName: string;
  materials: MaterialBill;
  currency: string;
  daysToFulfill: number;
  recipients: string[];
  shape: TradeShape | ShipShape;
}

export const CONT_SEND_DIRECT = act.addActionStep<Data>({
  type: 'CONT_SEND_DIRECT',
  totalMaterials: data => billQuantities(data.materials, (_, quantity) => quantity > 0),
  description: data => {
    const materialCount = Object.keys(data.materials).length;
    const kindLabel =
      data.shape.kind === 'TRADE' ? (data.shape.tradeType === 'BUYING' ? 'Buy' : 'Sell') : 'Ship';
    return `${kindLabel} contract (${fixed0(materialCount)} materials) → ${data.recipients.length} recipient(s)`;
  },
  execute: async ctx => {
    const { data, log, setStatus, requestTile, waitAct, complete } = ctx;
    const assert: AssertFn = ctx.assert;
    const { shape } = data;

    const typeLabel =
      shape.kind === 'TRADE' ? (shape.tradeType === 'BUYING' ? 'Buy' : 'Sell') : 'Ship';

    // Step 1: Create new draft. It is a reusable template: the same draft is sent
    // to every recipient in turn below, then deleted once everyone has a copy.
    const listTile = await requestTile('CONTD');
    if (!listTile) {
      return;
    }

    const newDraft = await createNewDraft(ctx, listTile);

    setStatus(`Loading draft ${newDraft.naturalId}...`);
    const draftTile = await requestTile(`CONTD ${newDraft.naturalId}`);
    if (!draftTile) {
      return;
    }
    const anchor = draftTile.anchor;

    const dateStr = ddmm();
    const contractName = `${data.packageName} - ${typeLabel} - ${dateStr}`;

    const materialsList = Object.entries(data.materials)
      .map(([ticker, { quantity: amount, price }]) => {
        return price !== undefined
          ? `${ticker} x${fixed0(amount)} @ ${fixed02(price)}/u`
          : `${ticker} x${fixed0(amount)}`;
      })
      .join(', ');
    const preambleText =
      `${typeLabel} contract.\n` +
      `Materials: ${materialsList}\n` +
      (data.daysToFulfill > 0 ? `Fulfill within ${fixed0(data.daysToFulfill)} days` : '');

    await setDraftNameAndPreamble(ctx, anchor, contractName, preambleText);

    // Save draft details (name/preamble).
    await waitAct('Save draft details?');
    await saveDraftDetails(ctx, draftTile, newDraft.naturalId);

    const templateSelect = await openTemplate(ctx, anchor);
    selectTemplateType(ctx, templateSelect, shape.kind === 'TRADE' ? shape.tradeType : 'SHIP');
    await setCurrency(ctx, anchor, data.currency);

    const materialEntries = Object.entries(data.materials)
      .filter(([, x]) => x.quantity > 0)
      .map(([ticker, { quantity: amount }]) => ({ ticker, amount }));

    if (shape.kind === 'TRADE') {
      // Trade charges a per-material price, set on each row as it is added.
      await addMaterials(ctx, anchor, materialEntries, {
        setPrice: (group, ticker) => {
          // Fail on a missing price to prevent a free trade.
          const price = data.materials[ticker].price;
          assert(isValidContractPrice(price), `Invalid price for ${ticker}`);
          const priceInput = _$$(group, 'input').find(x => x.inputMode === 'decimal');
          assert(priceInput, `Could not find price input for ${ticker}`);
          selectAndChangeInputValue(priceInput, fixed02(price));
          log.info(`Price for ${ticker}: ${fixed02(price)} ${data.currency}`);
        },
      });

      const addressContainers = _$$(anchor, C.AddressSelector.container);
      assert(
        addressContainers.length >= 1 && shape.location.length > 0,
        'Could not find trade location control',
      );
      await waitAct(`Set location to ${shape.location}?`);
      const locationSet = await selectAddress(addressContainers[0], shape.location);
      assert(locationSet, `Could not select location: ${shape.location}`);
      log.info(`Location set: ${shape.location}`);
    } else {
      // Ship charges a single flat price for the whole contract, divided across
      // commodities - there is no per-material price to set while adding rows.
      await addMaterials(ctx, anchor, materialEntries);

      let totalTonnage = 0;
      for (const { ticker, amount } of materialEntries) {
        const material = materialsStore.getByTicker(ticker);
        totalTonnage += material ? material.weight * amount : amount;
      }

      if (shape.payment > 0 && materialEntries.length > 0) {
        const pricePerCommodity = Math.round(shape.payment / materialEntries.length);
        const priceInput = findShipPriceInput(anchor);
        assert(priceInput, 'Could not find price input');
        selectAndChangeInputValue(priceInput, String(pricePerCommodity));
        log.info(
          `Price set: ${fixed0(pricePerCommodity)} ${data.currency}/commodity x${fixed0(materialEntries.length)} = ${fixed0(pricePerCommodity * materialEntries.length)} ${data.currency} total (${fixed2(totalTonnage)}t)`,
        );
      }

      const addressContainers = _$$(anchor, C.AddressSelector.container);
      assert(addressContainers.length >= 1, 'Could not find origin control');
      await waitAct(`Set origin to ${shape.contOrigin}?`);
      const originSet = await selectAddress(addressContainers[0], shape.contOrigin);
      assert(originSet, `Could not select origin: ${shape.contOrigin}`);
      log.info(`Origin set: ${shape.contOrigin}`);

      assert(addressContainers.length >= 2, 'Could not find destination control');
      await waitAct(`Set destination to ${shape.contDest}?`);
      const destSet = await selectAddress(addressContainers[1], shape.contDest);
      assert(destSet, `Could not select destination: ${shape.contDest}`);
      log.info(`Destination set: ${shape.contDest}`);

      if (shape.autoProvisionStoreId !== undefined) {
        setStatus('Setting auto-provision store...');
        const storeSelect = await pollUntil(() => {
          const select = _$(anchor, C.StoreSelect.container) as HTMLSelectElement | undefined;
          return select !== undefined && select.options.length > 1 ? select : undefined;
        }, 5000);
        assert(storeSelect, 'Auto-provision store select did not appear');

        const normalizedId = shape.autoProvisionStoreId.replaceAll('-', '');
        const optionIndex = Array.from(storeSelect.options).findIndex(
          x => x.value === shape.autoProvisionStoreId || x.value === normalizedId,
        );
        assert(
          optionIndex >= 0,
          `Could not find auto-provision store option: ${shape.autoProvisionStoreId}`,
        );
        changeSelectIndex(storeSelect, optionIndex);
        log.info(`Auto-provision store set: ${storeSelect.options[optionIndex].text}`);
      }
    }

    setDeadline(ctx, anchor, data.daysToFulfill);

    // Apply template.
    await waitAct('Apply template?');
    await applyTemplate(ctx, anchor, newDraft.naturalId);

    // Save conditions, after the player has reviewed them.
    await waitAct('Save conditions?');
    await saveConditions(ctx, draftTile, newDraft.naturalId);

    // Send the same draft to every recipient in turn.
    for (const recipient of data.recipients) {
      await waitAct(`Set recipient to ${recipient} and send?`);
      await setRecipient(ctx, anchor, recipient);
      await sendToRecipient(ctx, draftTile, recipient);
    }

    // Clean up: the draft is just a reusable template, not a real pending contract -
    // delete it from the list so it does not linger. This only works from the list
    // tile, not from the draft's own detail tile.
    await waitAct('Delete draft?');
    await deleteDraftFromList(ctx);

    log.success(`Contract sent to ${data.recipients.length} recipient(s)`);
    complete();
  },
});
