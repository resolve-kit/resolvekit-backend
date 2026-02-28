import { prisma } from "./prisma";
import { AuthDeveloper } from "./auth";

export async function getOwnedAppOrNull(appId: string, developer: AuthDeveloper) {
  const app = await prisma.app.findUnique({
    where: { id: appId },
  });
  if (!app) return null;
  if (app.organizationId !== developer.organizationId) return null;
  return app;
}
