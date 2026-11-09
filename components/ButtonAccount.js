/* eslint-disable @next/next/no-img-element */
"use client";

import { Popover, Transition } from "@headlessui/react";
import { useSession, signIn, signOut } from "next-auth/react";

/**
 * Google-style account menu.
 * Avatar = Google profile only. Settings logo is for public booking page.
 * Placed under Calio logo, above Workspace nav — panel opens downward.
 */
const ButtonAccount = () => {
  const { data: session, status } = useSession();

  if (status === "unauthenticated") return null;

  const avatarSrc = session?.user?.image || null;
  const name = session?.user?.name || "Account";
  const email = session?.user?.email || "";

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  const handleAddAccount = () => {
    signIn(
      "google",
      { callbackUrl: "/dashboard" },
      { prompt: "select_account" }
    );
  };

  return (
    <Popover className="relative z-20">
      {({ open }) => (
        <>
          <Popover.Button
            className="rounded-full p-0 overflow-hidden border-2 border-base-300 hover:border-base-content/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Account menu"
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="size-11 rounded-full object-cover sm:size-12"
                referrerPolicy="no-referrer"
                width={48}
                height={48}
              />
            ) : (
              <span className="flex size-11 sm:size-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-content">
                {(name || email || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </Popover.Button>

          <Transition
            show={open}
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Popover.Panel
              static
              className="absolute left-0 top-full mt-2 z-30 w-[min(100vw-2rem,20rem)] origin-top-left"
            >
              <div className="rounded-2xl bg-base-100 p-2 shadow-xl ring-1 ring-base-content/10">
                <div className="flex items-center gap-3 rounded-xl bg-base-200/80 px-3 py-3">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt=""
                      className="size-12 rounded-full object-cover shrink-0"
                      referrerPolicy="no-referrer"
                      width={48}
                      height={48}
                    />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-content">
                      {(name || email || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-base-content">
                      {name}
                    </p>
                    {email ? (
                      <p className="truncate text-xs text-base-content/55">
                        {email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={handleAddAccount}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-base-content hover:bg-base-200 transition-colors"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-base-200 text-base-content/70">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-5"
                      >
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                      </svg>
                    </span>
                    新增其他帳戶
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-base-content hover:bg-base-200 transition-colors"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-base-200 text-base-content/70">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                          clipRule="evenodd"
                        />
                        <path
                          fillRule="evenodd"
                          d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    登出
                  </button>
                </div>
              </div>
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
};

export default ButtonAccount;
