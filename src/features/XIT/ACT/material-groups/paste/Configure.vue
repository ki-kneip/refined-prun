<script setup lang="ts">
import PasteTextarea from '@src/features/XIT/ACT/material-groups/paste/PasteTextarea.vue';
import { Config } from '@src/features/XIT/ACT/material-groups/paste/config';

const { config } = defineProps<{ data: UserData.MaterialGroupData; config: Config }>();
</script>

<template>
  <PasteTextarea v-model="config.materials" />
</template>
