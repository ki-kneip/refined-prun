<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';

const { pkg } = defineProps<{ pkg: UserData.RecurringPackageData }>();

// Fires whenever a run stops, including a cancelled one. Good enough to clear the
// "due" indicator; if nothing was actually sent, running it again costs one click.
function onAfterExecute() {
  pkg.lastRun = Date.now();
}
</script>

<template>
  <ExecuteActionPackage :pkg="pkg" :after-execute="onAfterExecute" />
</template>
