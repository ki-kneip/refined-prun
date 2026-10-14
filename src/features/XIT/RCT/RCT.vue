<script setup lang="ts">
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import RecurringPackageList from '@src/features/XIT/RCT/RecurringPackageList.vue';
import EditRecurringPackage from '@src/features/XIT/RCT/EditRecurringPackage.vue';
import ExecuteRecurringPackage from '@src/features/XIT/RCT/ExecuteRecurringPackage.vue';
import { userData } from '@src/store/user-data';

const parameters = useXitParameters();
parameters.unshift('RCT');

let pkgName = undefined as string | undefined;
const edit = parameters[1]?.toLowerCase() === 'edit';
if (edit) {
  pkgName = parameters.slice(2).join(' ');
}
const run = parameters[1] !== undefined && !edit;
if (run) {
  pkgName = parameters.slice(1).join(' ');
}

const pkg = computed(() => userData.recurringPackages.find(x => x.global.name === pkgName));
</script>

<template>
  <RecurringPackageList v-if="parameters.length === 1" />
  <div v-else-if="!pkg">Recurring package "{{ pkgName }}" not found.</div>
  <EditRecurringPackage v-else-if="edit" :pkg="pkg" />
  <ExecuteRecurringPackage v-else :pkg="pkg" />
</template>
