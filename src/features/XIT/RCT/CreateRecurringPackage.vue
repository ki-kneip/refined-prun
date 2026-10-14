<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import Active from '@src/components/forms/Active.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import NumericInput from '@src/components/forms/NumericInput.vue';
import Commands from '@src/components/forms/Commands.vue';
import { isValidPackageName } from '@src/features/XIT/ACT/utils';

const { onCreate } = defineProps<{ onCreate: (name: string, intervalDays: number) => void }>();

const emit = defineEmits<{ (e: 'close'): void }>();

const name = ref('');
const nameError = ref(false);
watch(name, () => (nameError.value = !isValidPackageName(name.value)));

const intervalDays = ref(7);

function onCreateClick() {
  if (name.value.length === 0 || !isValidPackageName(name.value)) {
    nameError.value = true;
    return;
  }
  onCreate(name.value, Math.max(1, Math.trunc(intervalDays.value)));
  emit('close');
}
</script>

<template>
  <div :class="C.DraftConditionEditor.form">
    <SectionHeader>Create Recurring Package</SectionHeader>
    <form>
      <Active label="Name" :error="nameError">
        <TextInput v-model="name" />
      </Active>
      <Active label="Repeat Every (days)">
        <NumericInput v-model="intervalDays" :min="1" :step="1" />
      </Active>
      <Commands>
        <PrunButton primary @click="onCreateClick">CREATE</PrunButton>
      </Commands>
    </form>
  </div>
</template>
