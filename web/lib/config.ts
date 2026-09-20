/**
 * The deployment this app reads and writes. The default is the deployment
 * of record, byte-verified against contracts/structura.py; an environment
 * override points a checkout at another deployment (a disposable one for
 * testing), and the app says so on every sheet.
 */
export const RECORD_ADDRESS = "0xdB12cDb2039Aee85c5A1E23490b72f4B676D04c4";

const override = process.env.NEXT_PUBLIC_STRUCTURA_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The repository whose contract file this deployment was built from. */
export const REPO_URL = "https://github.com/Hemmy1417/Structura";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/structura.py`;
