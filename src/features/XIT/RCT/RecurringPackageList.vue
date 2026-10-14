<script setup lang="ts">
import ActionBar from '@src/components/ActionBar.vue';
import PrunButton from '@src/components/PrunButton.vue';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { showConfirmationOverlay, showTileOverlay } from '@src/infrastructure/prun-ui/tile-overlay';
import CreateRecurringPackage from '@src/features/XIT/RCT/CreateRecurringPackage.vue';
import { userData } from '@src/store/user-data';
import PrunLink from '@src/components/PrunLink.vue';
import removeArrayElement from '@src/utils/remove-array-element';
import { objectId } from '@src/utils/object-id';
import { vDraggable } from 'vue-draggable-plus';
import { grip } from '@src/components/grip';
import GripCell from '@src/components/grip/GripCell.vue';
import GripHeaderCell from '@src/components/grip/GripHeaderCell.vue';
import { ddmmyyyy } from '@src/utils/format';
import { timestampEachMinute } from '@src/utils/dayjs';

const recurringPackages = computed(() => userData.recurringPackages);

function onCreateClick(ev: Event) {
  showTileOverlay(ev, CreateRecurringPackage, {
    onCreate: (name: string, intervalDays: number) => {
      userData.recurringPackages.push({
        global: { name },
        groups: [],
        actions: [],
        intervalDays,
      });
      showBuffer('XIT RCT_EDIT_' + name.split(' ').join('_'));
    },
  });
}

function onDeleteClick(ev: Event, pkg: UserData.RecurringPackageData) {
  showConfirmationOverlay(ev, () => removeArrayElement(userData.recurringPackages, pkg), {
    message: `Are you sure you want to delete the recurring package "${pkg.global.name}"?`,
    confirmLabel: 'DELETE',
  });
}

function friendlyName(pkg: UserData.RecurringPackageData) {
  return pkg.global.name.split('_').join(' ');
}

function paramName(pkg: UserData.RecurringPackageData) {
  return pkg.global.name.split(' ').join('_');
}

function isDue(pkg: UserData.RecurringPackageData) {
  if (pkg.lastRun === undefined) {
    return true;
  }
  return timestampEachMinute.value - pkg.lastRun >= pkg.intervalDays * 86400000;
}

function dueLabel(pkg: UserData.RecurringPackageData) {
  if (pkg.lastRun === undefined) {
    return 'Never run';
  }
  return `Last run ${ddmmyyyy(pkg.lastRun)}`;
}
</script>

<template>
  <ActionBar>
    <PrunButton primary @click="onCreateClick">CREATE NEW</PrunButton>
  </ActionBar>
  <table>
    <thead>
      <tr>
        <GripHeaderCell />
        <th>Name</th>
        <th>Status</th>
        <th>Execute</th>
        <th>Edit</th>
        <th>Delete</th>
      </tr>
    </thead>
    <tbody v-if="recurringPackages.length === 0">
      <tr>
        <td colspan="6">No recurring packages.</td>
      </tr>
    </tbody>
    <tbody v-else v-draggable="[recurringPackages, grip.draggable]">
      <tr v-for="pkg in recurringPackages" :key="objectId(pkg)">
        <GripCell />
        <td>
          <PrunLink inline :command="`XIT RCT_${paramName(pkg)}`">
            {{ friendlyName(pkg) }}
          </PrunLink>
        </td>
        <td :class="{ [$style.due]: isDue(pkg) }">
          {{ isDue(pkg) ? `Due (${dueLabel(pkg)})` : dueLabel(pkg) }}
        </td>
        <td>
          <PrunButton primary @click="showBuffer(`XIT RCT_${paramName(pkg)}`)">
            EXECUTE
          </PrunButton>
        </td>
        <td>
          <PrunButton primary @click="showBuffer(`XIT RCT_EDIT_${paramName(pkg)}`)">
            EDIT
          </PrunButton>
        </td>
        <td>
          <PrunButton dark inline @click="onDeleteClick($event, pkg)">delete</PrunButton>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style module>
.due {
  color: rgb(217, 83, 79);
}
</style>
