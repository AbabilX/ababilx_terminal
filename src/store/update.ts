import { create } from "zustand";

import {
  checkForUpdate,
  dismissUpdate,
  type UpdateInfo,
} from "../lib/updateCheck";

interface UpdateStore {
  info: UpdateInfo | null;
  check: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  info: null,
  check: async () => {
    const info = await checkForUpdate();
    set({ info });
  },
  dismiss: () => {
    const { info } = get();
    if (info) dismissUpdate(info.latest);
    set({ info: null });
  },
}));
