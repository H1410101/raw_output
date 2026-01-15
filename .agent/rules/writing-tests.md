---
trigger: model_decision
description: when writing UI tests
---

Where a rule needs to be referenced in conversation, cite the rule number and quote the rule in its entirety.

1. favor tests on real html/css, rather than mocks
2. test files should have as few rendered references as possible; that is, all tests should ideally operate on the same UI
3. an increased number of rendered references is allowable only if it is functionally impossible for the tested entities to be simultaneously rendered; eg testing position and property synchronization across different views or pages
4. if previous tests do not mutate the reference, the rendered reference should not be re-rendered
5. the rendered reference should be edited to tests limits as required by tests
6. treat tests as sequential properties; further tests should assume that previous tests passed
7. write tests with the same code quality as normal code; that is, tests should read like high-level explanations of how they work
8. all possible failure states under a test should emit helpful error messages. this must exclude failure states only possible by also failing a preceeding test property