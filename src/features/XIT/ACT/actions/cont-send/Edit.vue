<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import SelectInput from '@src/components/forms/SelectInput.vue';
import NumericInput from '@src/components/forms/NumericInput.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import PrunButton from '@src/components/PrunButton.vue';
import Commands from '@src/components/forms/Commands.vue';
import { groupTargetPrefix } from '@src/features/XIT/ACT/shared-types';
import { useContLocations } from '@src/features/XIT/ACT/actions/cont-locations';
import { balancesStore } from '@src/infrastructure/prun-api/data/balances';
import { maxContractDays, minContractDays } from '@src/features/XIT/ACT/actions/cont-limits';
import { serializeStorage } from '@src/features/XIT/ACT/actions/utils';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { getEntityNameFromAddress } from '@src/infrastructure/prun-api/data/addresses';

const { action, pkg } = defineProps<{
  action: UserData.ActionData;
  pkg: UserData.ActionPackageData;
}>();

const materialGroups = computed(() => pkg.groups.map(x => x.name!).filter(x => x));
const materialGroup = ref(action.group ?? materialGroups.value[0]);

const contractTypes = ['Trade', 'Ship'];
const contractKind = ref(action.contractKind ?? 'Trade');
const isShip = computed(() => contractKind.value === 'Ship');

const tradeTypes = ['Buy', 'Sell'];
const tradeTypeToValue: Record<string, 'BUYING' | 'SELLING'> = {
  Buy: 'BUYING',
  Sell: 'SELLING',
};
const valueToTradeType: Record<string, string> = {
  BUYING: 'Buy',
  SELLING: 'Sell',
};
const tradeType = ref(valueToTradeType[action.contTradeType ?? 'SELLING'] ?? 'Sell');

const staticLocations = useContLocations();

// A group with no planet resolves to nothing at run time, so it is not offered.
const groupTargetOptions = computed(() =>
  pkg.groups
    .filter(x => x.name && x.planet)
    .map(x => ({
      label: `[${x.name}] target`,
      value: `${groupTargetPrefix}${x.name}`,
    })),
);

const locationOptions = computed(() => [...groupTargetOptions.value, ...staticLocations.value]);

// The currencies the player actually holds a balance in.
const currencies = computed(() => balancesStore.currencies.value ?? []);

const contLocation = ref(action.contLocation ?? staticLocations.value[0] ?? '');
const contOrigin = ref(action.contOrigin ?? staticLocations.value[0] ?? '');
const contDest = ref(action.contDest ?? staticLocations.value[0] ?? '');
const paymentPerTon = ref(action.paymentPerTon ?? 0);
const autoProvision = ref(action.autoProvision ?? false);
const currency = ref(action.currency ?? 'AIC');
const daysToFulfill = ref(action.daysToFulfill ?? 3);
// At least one empty slot so the form always shows a row to fill in.
const recipients = ref(
  action.recipients && action.recipients.length > 0 ? [...action.recipients] : [''],
);

const storeOptions = computed(() => {
  const origin = contOrigin.value;
  if (!origin || !autoProvision.value) {
    return [];
  }
  const result: { label: string; value: string }[] = [];
  for (const store of storagesStore.nonFuelStores.value ?? []) {
    let address: PrunApi.Address | undefined;
    if (store.type === 'STORE') {
      address = sitesStore.getById(store.addressableId)?.address;
    } else if (store.type === 'WAREHOUSE_STORE') {
      address = warehousesStore.getById(store.addressableId)?.address;
    } else {
      continue;
    }
    if (getEntityNameFromAddress(address) === origin) {
      result.push({ label: serializeStorage(store), value: store.id });
    }
  }
  return result;
});

const autoProvisionStoreId = ref(action.autoProvisionStoreId);
watchEffect(() => {
  const ids = new Set(storeOptions.value.map(x => x.value));
  if (autoProvisionStoreId.value && !ids.has(autoProvisionStoreId.value)) {
    autoProvisionStoreId.value = undefined;
  }
  if (!autoProvisionStoreId.value && storeOptions.value.length > 0) {
    autoProvisionStoreId.value = storeOptions.value[0].value;
  }
});

function onAddRecipientClick() {
  recipients.value.push('');
}

function onRemoveRecipientClick(index: number) {
  recipients.value.splice(index, 1);
}

function validate() {
  if (!materialGroup.value) {
    return false;
  }
  const locations = locationOptions.value.map(x => (typeof x === 'string' ? x : x.value));
  if (isShip.value) {
    if (!locations.includes(contOrigin.value) || !locations.includes(contDest.value)) {
      return false;
    }
    const payment = Number(paymentPerTon.value);
    if (!Number.isFinite(payment) || payment < 0) {
      return false;
    }
    if (autoProvision.value && !autoProvisionStoreId.value) {
      return false;
    }
  } else if (!locations.includes(contLocation.value)) {
    // A location saved before the player abandoned that base is no longer selectable.
    return false;
  }
  const days = Number(daysToFulfill.value);
  if (!Number.isInteger(days) || days < minContractDays || days > maxContractDays) {
    return false;
  }
  if (recipients.value.every(x => x.trim().length === 0)) {
    return false;
  }
  return true;
}

function save() {
  action.group = materialGroup.value;
  action.contractKind = contractKind.value as UserData.ActionData['contractKind'];
  action.currency = currency.value;
  action.daysToFulfill = Number(daysToFulfill.value);
  action.recipients = recipients.value.map(x => x.trim()).filter(x => x.length > 0);

  if (isShip.value) {
    action.contOrigin = contOrigin.value;
    action.contDest = contDest.value;
    action.paymentPerTon = Number(paymentPerTon.value);
    action.autoProvision = autoProvision.value;
    action.autoProvisionStoreId = autoProvision.value ? autoProvisionStoreId.value : undefined;
  } else {
    action.contTradeType = tradeTypeToValue[tradeType.value];
    action.contLocation = contLocation.value;
  }
}

defineExpose({ validate, save });
</script>

<template>
  <Active label="Material Group">
    <SelectInput v-model="materialGroup" :options="materialGroups" />
  </Active>

  <Active label="Contract Type">
    <SelectInput v-model="contractKind" :options="contractTypes" />
  </Active>

  <template v-if="isShip">
    <Active label="Origin">
      <SelectInput v-model="contOrigin" :options="locationOptions" />
    </Active>

    <Active label="Destination">
      <SelectInput v-model="contDest" :options="locationOptions" />
    </Active>

    <Active label="Payment per Ton">
      <NumericInput v-model="paymentPerTon" :min="0" :step="1" placeholder="0" />
    </Active>

    <Active label="Auto-provision">
      <RadioItem v-model="autoProvision">enable auto-provision</RadioItem>
    </Active>

    <Active v-if="autoProvision" label="Auto-provision Store">
      <SelectInput v-model="autoProvisionStoreId" :options="storeOptions" />
    </Active>
  </template>
  <template v-else>
    <Active label="Trade Type">
      <SelectInput v-model="tradeType" :options="tradeTypes" />
    </Active>

    <Active label="Location">
      <SelectInput v-model="contLocation" :options="locationOptions" />
    </Active>
  </template>

  <Active label="Currency">
    <SelectInput v-model="currency" :options="currencies" />
  </Active>

  <Active label="Days to Fulfill">
    <NumericInput v-model="daysToFulfill" :min="minContractDays" :max="maxContractDays" :step="1" />
  </Active>

  <template v-for="(_, i) in recipients" :key="i">
    <Active :label="`Recipient #${i + 1}`">
      <TextInput v-model="recipients[i]" />
      <PrunButton v-if="recipients.length > 1" dark inline @click="onRemoveRecipientClick(i)">
        remove
      </PrunButton>
    </Active>
  </template>
  <Commands>
    <PrunButton primary @click="onAddRecipientClick">ADD RECIPIENT</PrunButton>
  </Commands>
</template>
