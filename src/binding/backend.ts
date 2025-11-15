import { invoke } from '@tauri-apps/api/core';

export const queryResults = async () => {
    const bing = await invoke('query_results', {
        number: 42,
    })

    debugger;
}
