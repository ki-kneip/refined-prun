import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ACT/actions/cont-send/Edit.vue';
import { CONT_SEND_DIRECT } from '@src/features/XIT/ACT/action-steps/CONT_SEND_DIRECT';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';
import { displayLocationValue } from '@src/features/XIT/ACT/actions/cont-locations';
import {
  isValidContractPrice,
  maxContractPrice,
  minContractPrice,
} from '@src/features/XIT/ACT/actions/cont-limits';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { fixed02 } from '@src/utils/format';

act.addAction({
  type: 'CONT Send',
  shortDescription:
    'Create and send a buying, selling, or shipping contract directly to specific recipients',
  description: action => {
    const recipients = action.recipients ?? [];
    const kind = action.contractKind ?? 'Trade';
    if (!action.group || recipients.length === 0) {
      return '--';
    }
    const recipientsLabel =
      recipients.length === 1 ? recipients[0] : `${recipients.length} recipients`;

    if (kind === 'Ship') {
      if (!action.contOrigin || !action.contDest) {
        return '--';
      }
      const origin = displayLocationValue(action.contOrigin);
      const dest = displayLocationValue(action.contDest);
      const payment = action.paymentPerTon ?? 0;
      const paymentStr = payment > 0 ? ` @ ${fixed02(payment)}/t` : '';
      return `Ship contract for [${action.group}] from ${origin} to ${dest}${paymentStr} → ${recipientsLabel}`;
    }

    if (!action.contLocation) {
      return '--';
    }
    const tradeLabel = action.contTradeType === 'BUYING' ? 'Buy' : 'Sell';
    const location = displayLocationValue(action.contLocation);
    return `${tradeLabel} contract for [${action.group}] at ${location} → ${recipientsLabel}`;
  },
  editComponent: Edit,
  generateSteps: async ctx => {
    const { data, packageName, getMaterialGroup, emitStep } = ctx;
    const assert: AssertFn = ctx.assert;

    const materials = await getMaterialGroup(data.group);
    assert(materials, 'Invalid material group');

    const traded = Object.values(materials).filter(x => x.quantity > 0);
    assert(traded.length > 0, 'Material group has no materials');

    const recipients = data.recipients ?? [];
    assert(recipients.length > 0, 'No recipients configured');

    const daysToFulfill = data.daysToFulfill ?? 3;
    const currency = data.currency ?? 'AIC';
    const kind = data.contractKind ?? 'Trade';

    if (kind === 'Ship') {
      const contOrigin = data.contOrigin;
      const contDest = data.contDest;
      assert(contOrigin, 'Invalid origin');
      assert(contDest, 'Invalid destination');

      const paymentPerTon = Number(data.paymentPerTon ?? 0);
      let totalTonnage = 0;
      for (const [ticker, { quantity }] of Object.entries(materials)) {
        const material = materialsStore.getByTicker(ticker);
        totalTonnage += material ? material.weight * quantity : quantity;
      }
      const totalPayment = Math.round(totalTonnage * paymentPerTon);

      emitStep(
        CONT_SEND_DIRECT({
          packageName,
          materials,
          currency,
          daysToFulfill,
          recipients,
          shape: {
            kind: 'SHIP',
            contOrigin,
            contDest,
            payment: totalPayment,
            autoProvisionStoreId: data.autoProvision ? data.autoProvisionStoreId : undefined,
          },
        }),
      );
      return;
    }

    // Reject missing prices before editing a draft; a blank price creates a free trade.
    assert(
      traded.every(x => isValidContractPrice(x.price)),
      `Each material in [${data.group}] needs a price from ${minContractPrice} to ${maxContractPrice}. Use a Paste group with 3 columns (ticker, amount, price).`,
    );

    const location = data.contLocation;
    assert(location, 'Invalid location');

    const tradeType = data.contTradeType ?? 'SELLING';

    emitStep(
      CONT_SEND_DIRECT({
        packageName,
        materials,
        currency,
        daysToFulfill,
        recipients,
        shape: { kind: 'TRADE', tradeType, location },
      }),
    );
  },
});
