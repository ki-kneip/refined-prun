import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ACT/material-groups/paste/Edit.vue';
import Configure from '@src/features/XIT/ACT/material-groups/paste/Configure.vue';
import { Config } from '@src/features/XIT/ACT/material-groups/paste/config';
import {
  parseMaterials,
  ResolveTicker,
} from '@src/features/XIT/ACT/material-groups/paste/paste-parse';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';

export const resolveTicker: ResolveTicker = ticker => materialsStore.getByTicker(ticker)?.ticker;

function isDesignTime(data: UserData.MaterialGroupData) {
  return data.pasteTiming === 'Design';
}

act.addMaterialGroup<Config>({
  type: 'Paste',
  shortDescription: 'Paste materials from clipboard, either now or at execution time',
  description: data => {
    if (!isDesignTime(data)) {
      return 'Paste materials at execution time';
    }
    const result = parseMaterials(data.pasteText, resolveTicker);
    const count = result ? Object.keys(result).length : 0;
    return count > 0
      ? `${count} material${count === 1 ? '' : 's'} pasted`
      : 'No materials pasted yet';
  },
  editComponent: Edit,
  configureComponent: Configure,
  needsConfigure: data => !isDesignTime(data),
  isValidConfig: (data, config) =>
    isDesignTime(data) || parseMaterials(config.materials, resolveTicker) !== undefined,
  generateMaterialBill: async ({ data, config, log }) => {
    const text = isDesignTime(data) ? data.pasteText : config.materials;
    const result = parseMaterials(text, resolveTicker);
    if (!result) {
      log.error('Invalid or missing pasted materials.');
      return undefined;
    }
    return result;
  },
});
