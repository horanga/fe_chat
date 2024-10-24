"use client";

import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { Sidebar } from "../sidebar";
import { Chat } from "./chat";
import { User, Message } from "@/app/data";
import api from "@/lib/axios";
import { redirect } from "next/navigation";

import * as StompJs from "@stomp/stompjs";
import { User, User } from "lucide-react";
import { useUnmountEffect } from "framer-motion";

interface ChatLayoutProps {
  defaultLayout: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
}

function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
}

export function ChatLayout({
  defaultLayout = [320, 480],
  defaultCollapsed = false,
  navCollapsedSize,
}: ChatLayoutProps) {
  const [connectedUsers, setConnectedUsers] = React.useState<User[]>([]);
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);

  const me = useRef<string>(null);

  const [client, setClient] = React.useState<Client | null>(null);

  const [messagesState, setMessages] = React.useState<Message[]>(
    selectedUser?.messages ?? [] // selectedUser가 null일 경우 빈 배열을 사용
  );

  const useMountEffect = () => {
    const authCookie = getCookie("auth");

    if (!authCookie) {
      redirect("/login");
      return;
    }

    const verifyAuthToken = async () => {
      const result = await api.get(`/api/v1/auth/verify-token/${authCookie}`);
      me.current = result.data;
    };

    verifyAuthToken();

    if (client === null) {
      const setSocket = async () => {
        const C = new StompJs.Client({
          brokerURL: "ws://43.200.53.153:7002/ws-stomp",
          connectHeaders: {
            Authorization: `Bearer ${authCookie}`,
          },
          reconnectDelay: 5000,
          onConnect: () => {
            console.log("connected");
            subscribe(C); // Pass the client instance
          },
          onWebSocketError: (error) => {
            console.log("Error with websocket", error);
          },
          onStompError: (frame) => {
            console.dir(`Broker reported error: ${frame.headers.message}`);
            console.dir(`Additional details: ${frame}`);
          },
        });

        setClient(C); // WebSocket 클라이언트를 저장
        C.activate();
      };

      setSocket();
    }
  };

  useMountEffect();

  const subscribe = (clientInstance: StompJs.Client) => {
    console.log("Subscribing...");
    clientInstance.subscribe(
      `/sub/chat`,
      (received_message: StompJs.IFrame) => {
        const message: Message = JSON.parse(received_message.body);
        const item = window.localStorage.getItem("selectedUser");

        if (item != null) {
          const user: User = JSON.parse(item);

          if (message.to == user.name || message.from == user.name) {
            setMessages((prevMessages) => [...prevMessages, message]);
          }
        }
      }
    );
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      onLayout={(sizes: number[]) => {
        document.cookie = `react-resizable-panels:layout=${JSON.stringify(
          sizes
        )}`;
      }}
      className="h-full items-stretch"
    >
      <ResizablePanel
        defaultSize={defaultLayout[0]}
        collapsedSize={navCollapsedSize}
        collapsible={true}
        minSize={24}
        maxSize={30}
        onCollapse={() => {
          setIsCollapsed(true);
          document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
            true
          )}`;
        }}
        onExpand={() => {
          setIsCollapsed(false);
          document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(
            false
          )}`;
        }}
        className={cn(
          isCollapsed &&
            "min-w-[50px] md:min-w-[70px] transition-all duration-300 ease-in-out"
        )}
      >
        <Sidebar
          me={me}
          isCollapsed={isCollapsed}
          links={connectedUsers}
          setConnectedUsers={setConnectedUsers}
          setSelectedUser={setSelectedUser}
          setMessages={setMessages}
        />
      </ResizablePanel>

      {selectedUser && (
        <>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
            <Chat
              messagesState={messagesState}
              me={me}
              client={client}
              selectedUser={selectedUser}
              setSelectedUser={setSelectedUser}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
