"use client";

import { VoiceProvider } from "@humeai/voice-react";
import Messages from "./Messages";
import Controls from "./Controls";
import StartCall from "./StartCall";
import { ContextualConversationManager } from "./ContextualConversationManager";
import { HumeApiTester } from "./HumeApiTester";
import { ComponentRef, useRef } from "react";

export default function ClientComponent({
  accessToken,
}: {
  accessToken: string;
}) {
  const timeout = useRef<number | null>(null);
  const ref = useRef<ComponentRef<typeof Messages> | null>(null);
  
  // For demo purposes, using a static user ID. In a real app, this would come from authentication
  const userId = "demo-user";

  // optional: use configId from environment variable
  const configId = process.env['NEXT_PUBLIC_HUME_CONFIG_ID'];
  
  return (
    <>
      <div
        className={
          "relative grow flex flex-col mx-auto w-full overflow-hidden h-[0px]"
        }
      >
        <VoiceProvider
          auth={{ type: "accessToken", value: accessToken }}
          configId={configId}
          onMessage={() => {
            if (timeout.current) {
              window.clearTimeout(timeout.current);
            }

            timeout.current = window.setTimeout(() => {
              if (ref.current) {
                const scrollHeight = ref.current.scrollHeight;

                ref.current.scrollTo({
                  top: scrollHeight,
                  behavior: "smooth",
                });
              }
            }, 200);
          }}
        >
          {/* Contextual Conversation Manager - handles localStorage and session context */}
          <ContextualConversationManager userId={userId} />

          <Messages ref={ref} />
          <Controls />
          <StartCall />
        </VoiceProvider>
      </div>

      {/* Hume API Tester - for development/testing */}
      <HumeApiTester />
    </>
  );
}
