// Preserve the legacy suite's ordered, shared-topic assertions using node:test.
module.exports = function runBatch(name, groups) {
  const { test } = require('node:test');
  test(name, async (t) => {
    for (const [groupName, group] of Object.entries(groups)) {
      for (const [assertion, run] of Object.entries(group)) {
        if (assertion !== 'topic') await t.test(groupName + ': ' + assertion, () => run(group.topic));
      }
    }
  });
};
