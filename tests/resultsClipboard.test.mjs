import assert from "node:assert/strict";
import test from "node:test";

import { buildResultsClipboardText } from "../src/utility/resultsClipboard.ts";

test("copies headers and rows in display order without row numbers", () => {
    const columns = [
        { attribute: "", dataKey: "__rownum" },
        { attribute: "Name", dataKey: "name" },
        { attribute: "City", dataKey: "city" },
    ];
    const rows = [
        { attributes: { __rownum: 2, name: "Beta", city: "Austin" } },
        { attributes: { __rownum: 1, name: "Acme", city: "Chicago" } },
    ];

    assert.equal(
        buildResultsClipboardText(rows, columns),
        "Name\tCity\r\nBeta\tAustin\r\nAcme\tChicago"
    );
});

test("quotes tabs, newlines and quotes while retaining displayed value formatting", () => {
    const columns = [
        { attribute: "Note\ttext", dataKey: "note" },
        { attribute: "Owner", dataKey: "owner" },
        { attribute: "Amount", dataKey: "amount" },
    ];
    const rows = [{
        attributes: {
            note: 'First\tline\n"Second"',
            owner: { id: "abc-123", logical_name: "systemuser" },
            amount: { value: "1.25" },
        },
    }];

    assert.equal(
        buildResultsClipboardText(rows, columns),
        '"Note\ttext"\tOwner\tAmount\r\n"First\tline\n""Second"""\tabc-123\t1.25'
    );
});

test("returns no clipboard text without data columns", () => {
    assert.equal(buildResultsClipboardText([], [{ attribute: "", dataKey: "__rownum" }]), "");
});
