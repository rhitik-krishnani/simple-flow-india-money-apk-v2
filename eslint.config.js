import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    files: ['firestore.rules'],
    ...firebaseRulesPlugin.configs['flat/recommended']
  },
];
