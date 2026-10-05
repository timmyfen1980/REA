// ==============================
// ButtonBar.jsx — FINAL VERSION
// ==============================

import React from "react";

export default function ButtonBar({
  buttons = [],
  qid,
  selectedAnswers = {},
  onClickButton
}) {
  if (!buttons || buttons.length === 0) return null;

  const selected = selectedAnswers[qid] || "";

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {buttons.map((btn) => {
        const isSelected =
          selected &&
          String(selected).toLowerCase() === String(btn).toLowerCase();

        return (
          <button
            key={btn}
            className={`px-3 py-1.5 rounded border text-sm transition-all
              ${
                isSelected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
              }`}
            onClick={() => onClickButton(btn)}
          >
            {btn}
          </button>
        );
      })}
    </div>
  );
}
