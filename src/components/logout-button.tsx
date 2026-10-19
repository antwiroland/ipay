"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

/**
 * Calls the logout action directly (not via a <form>): a form inside a dropdown menu is unmounted when the
 * menu closes, before it can submit. A full page load afterwards clears every piece of signed-in client state.
 */
export function useLogout() {
  const [pending, start] = useTransition();
  const logout = () =>
    start(async () => {
      await logoutAction();
      // Deliberate full page load (not router.push): drops the client router cache so no signed-in data lingers.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    });
  return { logout, pending };
}

export function LogoutButton({ className, children, label = "Log out" }: { className?: string; children?: React.ReactNode; label?: string }) {
  const { logout, pending } = useLogout();
  return (
    <button type="button" onClick={logout} disabled={pending} className={className} aria-label={label} aria-busy={pending || undefined}>
      {children ?? label}
    </button>
  );
}
