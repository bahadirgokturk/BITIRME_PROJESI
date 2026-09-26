// Vitest icin: testler ayni sahte handler'lari Node tarafinda kullanir
import { setupServer } from "msw/node";

import { handlers } from "./handlers";

export const server = setupServer(...handlers);
