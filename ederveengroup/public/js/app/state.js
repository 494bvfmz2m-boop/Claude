// EderveenGroup client: state
const state = {
    me: null,
    settings: null,
    folders: [],
    folder: 'INBOX',
    page: 0,
    total: 0,
    pageSize: 50,
    query: '',
    filter: '',
    messages: [],
    openUid: null,
    current: null, // full message open in reader
    checked: new Set(),
    lastChecked: null,
    allowImagesFor: new Set()
};

const FOLDER_ICONS = { '\\Snoozed': 'clock', '\\Inbox': 'inbox', '\\Sent': 'send', '\\Drafts': 'draft', '\\Trash': 'trash', '\\Junk': 'junk', '\\Archive': 'archive', '\\Flagged': 'star', '\\All': 'mail' };
const folderInfo = path => state.folders.find(f => f.path === path) || { path, name: path };
const specialPath = use => (state.folders.find(f => f.specialUse === use) || {}).path;
const isDrafts = () => folderInfo(state.folder).specialUse === '\\Drafts';
const isSentLike = () => ['\\Sent', '\\Drafts'].includes(folderInfo(state.folder).specialUse);

export { FOLDER_ICONS, folderInfo, isDrafts, isSentLike, specialPath, state };
