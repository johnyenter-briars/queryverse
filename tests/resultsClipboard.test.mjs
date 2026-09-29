import assert from "node:assert/strict";
import test from "node:test";

import {
    buildEntityReferenceRecordUrl,
    buildResultsClipboardText,
    formatResultValue,
    primaryIdToRecordReference,
} from "../src/utility/resultsClipboard.ts";

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

test("record links use the Dataverse URL and encoded entity identity", () => {
    const reference = { id: "a b", logical_name: "account/type" };
    assert.equal(formatResultValue(reference), "a b");
    assert.equal(
        buildEntityReferenceRecordUrl(reference, "https://example.crm.dynamics.com/"),
        "https://example.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=account%2Ftype&id=a%20b"
    );
});

test("only the base entity primary ID becomes a record reference", () => {
    const entity = {
        LogicalName: "account",
        SchemaName: "Account",
        EntitySetName: "accounts",
        IsCustomEntity: false,
        PrimaryIdAttribute: "accountid",
    };
    const id = "00000000-0000-0000-0000-000000000123";
    const reference = primaryIdToRecordReference(id, "AccountId", entity);

    assert.deepEqual(reference, { id, logical_name: "account" });
    assert.equal(
        buildEntityReferenceRecordUrl(reference, "https://example.crm.dynamics.com"),
        `https://example.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=account&id=${id}`
    );
    assert.equal(primaryIdToRecordReference(id, "contactid", entity), null);
    assert.equal(primaryIdToRecordReference(id, "accountid", undefined), null);
    assert.equal(primaryIdToRecordReference("not-a-guid", "accountid", entity), null);
    assert.deepEqual(primaryIdToRecordReference(`{${id}}`, "accountid", entity), {
        id: `{${id}}`,
        logical_name: "account",
    });
    assert.equal(primaryIdToRecordReference(`{${id}`, "accountid", entity), null);
});
