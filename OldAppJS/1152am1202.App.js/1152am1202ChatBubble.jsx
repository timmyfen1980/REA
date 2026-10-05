// =====================================================
// ChatBubble.jsx — SAFE, FINAL, WORKING VERSION
// =====================================================

import React from "react";
import ButtonBar from "./ButtonBar.jsx";

export default function ChatBubble({
  sender,
  text,
  buttons,
  selectedAnswers,
  qid,
  onClickButton
}) {
  const isTima = sender === "tima";

  // SAFETY: Only render text if it’s a string
  const safeText = typeof text === "string" ? text : "";

  return (
    <div
      className={`flex w-full ${
        isTima ? "justify-start" : "justify-end"
      }`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
          isTima
            ? "bg-gray-100 text-gray-900 border border-gray-300"
            : "bg-blue-600 text-white"
        }`}
      >
        {/* TEXT */}
        <div>{safeText}</div>

        {/* BUTTONS (TIMA messages only) */}
        {isTima && buttons && buttons.length > 0 && (
          <ButtonBar
            buttons={buttons}
            qid={qid}
            selectedAnswers={selectedAnswers}
            onClickButton={onClickButton}
          />
        )}
      </div>
    </div>
  );
}
