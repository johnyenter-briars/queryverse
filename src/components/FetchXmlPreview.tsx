import { Button } from "@fluentui/react-components";
import { FetchXmlPreview as FetchXmlPreviewModel } from "../binding/model/FetchXmlPreview";
import { useFetchXmlPreviewStyles } from "../styles/FetchXmlPreviewStyles";
import { combineClasses } from "../utility/class";

type FetchXmlPreviewProps = {
    fetchPreview: FetchXmlPreviewModel | null;
    previewError: string | null;
    onClear: () => void;
};

export const FetchXmlPreview = ({
    fetchPreview,
    previewError,
    onClear,
}: FetchXmlPreviewProps) => {
    const previewStyles = useFetchXmlPreviewStyles();

    if (!fetchPreview && !previewError) {
        return null;
    }

    return (
        <div className={previewStyles.previewPanel}>
            <div className={previewStyles.previewHeader}>
                <span>FetchXML Preview</span>
                <Button appearance="subtle" size="small" onClick={onClear}>
                    Clear
                </Button>
            </div>
            <pre
                className={combineClasses(
                    previewStyles.previewBody,
                    previewError ? previewStyles.previewError : undefined
                )}
            >
                {previewError ?? fetchPreview?.fetchXml}
            </pre>
            {fetchPreview?.entityLogical && (
                <div className={previewStyles.previewMeta}>
                    Entity: {fetchPreview.entityLogical} (set: {fetchPreview.entitySet})
                </div>
            )}
        </div>
    );
};
