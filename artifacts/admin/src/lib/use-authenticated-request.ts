import { useMemo } from "react";
import { useAuth } from "@clerk/react";

export function useAuthenticatedRequest() {
  const { getToken } = useAuth();

  return useMemo(
    () => ({
      authToken: getToken,
    }),
    [getToken],
  );
}
