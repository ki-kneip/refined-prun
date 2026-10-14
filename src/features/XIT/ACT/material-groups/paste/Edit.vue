<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import RadioItem from '@src/components/forms/RadioItem.vue';
import PasteTextarea from '@src/features/XIT/ACT/material-groups/paste/PasteTextarea.vue';
import { parsePaste } from '@src/features/XIT/ACT/material-groups/paste/paste-parse';
import { resolveTicker } from '@src/features/XIT/ACT/material-groups/paste/paste';

const { group } = defineProps<{ group: UserData.MaterialGroupData }>();

const isDesignTime = ref((group.pasteTiming ?? 'Execution') === 'Design');
const text = ref(group.pasteText ?? '');

function validate() {
  if (!isDesignTime.value) {
    return true;
  }
  const result = parsePaste(text.value, resolveTicker);
  return result.fatal === undefined && result.errors.length === 0 && result.rows.length > 0;
}

function save() {
  group.pasteTiming = isDesignTime.value ? 'Design' : 'Execution';
  if (isDesignTime.value) {
    group.pasteText = text.value;
  }
}

defineExpose({ validate, save });
</script>

<template>
  <Active
    label="Paste Timing"
    tooltip="Design time: paste the materials now and save them with the package. Execution time: paste fresh materials every time you run it.">
    <RadioItem v-model="isDesignTime">paste at design time</RadioItem>
  </Active>
  <PasteTextarea v-if="isDesignTime" v-model="text" />
</template>
