import RCT from '@src/features/XIT/RCT/RCT.vue';

xit.add({
  command: ['RCT', 'RECURRING'],
  name: parameters => {
    if (parameters.length === 0) {
      return 'RECURRING CONTRACTS';
    }
    if (parameters[0].toUpperCase() === 'EDIT') {
      return 'EDIT RECURRING PACKAGE';
    }
    return 'RUN RECURRING PACKAGE';
  },
  description: 'Automates recurring tasks, like weekly contracts sent to specific recipients.',
  optionalParameters: 'EDIT and/or Package Name',
  contextItems: parameters => (parameters.length > 0 ? [{ cmd: 'XIT RCT' }] : []),
  component: () => RCT,
});
