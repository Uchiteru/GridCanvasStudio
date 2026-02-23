import { useState, useRef, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Color } from '@tiptap/extension-color';
import TurndownService from 'turndown';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, mkdir, exists, readDir } from '@tauri-apps/plugin-fs';
import { snap, genId, GRID_SIZE } from './utils';
const CANVAS_WIDTH = 3200;
const CANVAS_HEIGHT = 2400;

const COLORS = {
  bg: "#f3f4f6",
  surface: "#ffffff",
  surfaceHover: "#f9fafb",
  border: "#d1d5db",
  borderActive: "#5b5bd6",
  accent: "#5b5bd6",
  accentSoft: "rgba(91,91,214,0.15)",
  text: "#111827",
  textMuted: "#6b7280",
  textDim: "#9ca3af",
  grid: "rgba(0,0,0,0.035)",
  gridMajor: "rgba(0,0,0,0.07)",
  nodeText: "#111827",
  nodeBg: "#ffffff",
  nodeFile: "#ffffff",
  nodeFileBorder: "#d1d5db",
  shadow: "rgba(0,0,0,0.08)",
};


const INITIAL_NODES = [
  {
    id: "text-001",
    type: "text",
    text: "<p><strong>【必須】</strong> ログイン画面の応答速度は<span style=\"font-size: large;\">1秒以内</span>とすること。</p>",
    x: 80,
    y: 80,
    width: 280,
    height: 120,
  },
  {
    id: "text-002",
    type: "text",
    text: "<p><strong>システム概要</strong><br/>新世代ドキュメント基盤の設計書です。</p>",
    x: 80,
    y: 240,
    width: 320,
    height: 120,
  },
  {
    id: "file-001",
    type: "file",
    file: "assets/system_architecture.drawio.svg",
    x: 80,
    y: 400,
    width: 320,
    height: 200,
  },
];

// ── Node Component ──────────────────────────────────────────────────────────
function CanvasNode({
  node,
  selected,
  onSelect,
  onDragStart,
  onResizeStart,
  onDoubleClick,
}) {
  const isText = node.type === "text";
  const isTable = node.type === "table";
  const isTextOrTable = isText || isTable;
  const isFile = node.type === "file";
  const isImage = node.type === "image";
  const isVisual = isFile || isImage;

  const handleMouseDown = (e) => {
    e.stopPropagation();
    onSelect(node.id, e.shiftKey);
    onDragStart(e, node.id, e.shiftKey);
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(e, node.id);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(node);
      }}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        boxSizing: "border-box",
        cursor: "grab",
        userSelect: "none",
        zIndex: selected ? 10 : 1,
      }}
    >
      {/* Title Bar */}
      {node.title && (
        <div
          style={{
            position: "absolute",
            top: -24,
            left: 0,
            background: selected ? COLORS.accent : COLORS.bg,
            color: selected ? "#fff" : COLORS.textMuted,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: "4px 4px 0 0",
            border: `1px solid ${selected ? COLORS.borderActive : "rgba(0,0,0,0.12)"}`,
            borderBottom: "none",
            whiteSpace: "nowrap",
            maxWidth: node.width,
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none",
            transition: "all 0.15s",
          }}
        >
          {node.title}
        </div>
      )}

      {/* Link Badge */}
      {node.linkToPageId && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (typeof node.onNavigate === "function") {
              node.onNavigate(node.linkToPageId);
            }
          }}
          style={{
            position: "absolute",
            top: -12,
            right: -12,
            background: COLORS.accent,
            color: "#fff",
            width: 24,
            height: 24,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: `0 2px 8px ${COLORS.shadow}`,
            zIndex: 20,
            pointerEvents: "auto",
          }}
          title="リンク先へ移動"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Node body */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isTextOrTable ? COLORS.nodeBg : COLORS.nodeFile,
          border: `1.5px solid ${selected ? COLORS.borderActive : isVisual ? COLORS.nodeFileBorder : "rgba(0,0,0,0.12)"}`,
          borderRadius: node.title ? "0 3px 3px 3px" : 3,
          boxShadow: selected
            ? `0 0 0 2px ${COLORS.accentSoft}, 0 4px 24px ${COLORS.shadow}`
            : `0 2px 8px ${COLORS.shadow}`,
          overflow: isTextOrTable ? "visible" : "hidden",
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
      >
        {isTextOrTable && (
          <div
            className="ProseMirror"
            style={{
              position: "absolute",
              inset: 0,
              padding: 12,
              color: COLORS.text,
              fontFamily: "'IBM Plex Sans', sans-serif",
              pointerEvents: "none",
              overflow: "hidden",
            }}
            dangerouslySetInnerHTML={{ __html: node.text }}
          />
        )}

        {isFile && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              position: "relative",
              gap: 8,
              textAlign: "center",
              padding: 16
            }}
          >
            {node.aiUpdated ? (
              <>
                <div style={{ fontSize: 24 }}>✨</div>
                <span style={{ fontSize: 11, color: COLORS.accent, fontWeight: 600 }}>
                  AIが図を更新しました
                </span>
                <span style={{ fontSize: 10, color: COLORS.textDim }}>
                  ダブルクリックして再描画（保存）してください
                </span>
              </>
            ) : node.svg ? (
              <img
                src={node.svg}
                alt="diagram"
                style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
              />
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    stroke={COLORS.accent}
                    strokeWidth="1.5"
                  />
                  <path
                    d="M7 8h10M7 12h10M7 16h6"
                    stroke={COLORS.accent}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  style={{
                    fontSize: 9,
                    color: COLORS.textMuted,
                    fontFamily: "monospace",
                    textAlign: "center",
                    padding: "0 8px",
                    wordBreak: "break-all",
                  }}
                >
                  {node.file}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: COLORS.accent,
                    fontFamily: "'IBM Plex Sans', sans-serif",
                  }}
                >
                  ダブルクリックで編集
                </span>
              </>
            )}
          </div>
        )}

        {isImage && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              position: "relative",
            }}
          >
            {node.imageData ? (
              <img
                src={node.imageData}
                alt="embedded"
                style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }}
              />
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke={COLORS.textMuted} strokeWidth="1.5" />
                  <circle cx="8.5" cy="8.5" r="1.5" fill={COLORS.textMuted} />
                  <path d="M21 15l-5-5L5 21" stroke={COLORS.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>画像なし</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Resize handle */}
      {
        selected && (
          <div
            onMouseDown={handleResizeMouseDown}
            style={{
              position: "absolute",
              right: -5,
              bottom: -5,
              width: 10,
              height: 10,
              background: COLORS.accent,
              border: "2px solid #fff",
              borderRadius: 2,
              cursor: "se-resize",
              zIndex: 20,
            }}
          />
        )
      }

      {/* Corner indicators when selected */}
      {
        selected && (
          <>
            {[
              { top: -3, left: -3 },
              { top: -3, right: -3 },
              { bottom: -3, left: -3 },
            ].map((pos, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 6,
                  height: 6,
                  background: COLORS.accent,
                  border: "1.5px solid #fff",
                  borderRadius: 1,
                  ...pos,
                }}
              />
            ))}
          </>
        )
      }
    </div >
  );
}

// ── Text Editor Modal ────────────────────────────────────────────────────────
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
      },
    }
  },
});

function TextEditorModal({ node, onSave, onClose }) {
  const text = node.text;
  const [width, setWidth] = useState(node.width);
  const [height, setHeight] = useState(node.height);
  const [showAiModal, setShowAiModal] = useState(false);

  const isTable = node.type === "table";

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontSize,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: node.text,
  });

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave({ ...node, text: editor ? editor.getHTML() : text, width, height });
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 24,
          width: isTable ? "90vw" : 720,
          height: isTable ? "90vh" : "auto",
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          boxShadow: `0 24px 80px rgba(0,0,0,0.2)`,
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: COLORS.accent,
            }}
          />
          <span
            style={{
              color: COLORS.text,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {isTable ? "テーブルノード編集" : "テキストノード編集"}
          </span>
          <span
            style={{
              marginLeft: "auto",
              color: COLORS.textMuted,
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            id: {node.id}
          </span>
        </div>

        <div style={{ background: "#fff", color: "#000", borderRadius: 4, overflow: "hidden", border: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", height: isTable ? "auto" : 350, flex: isTable ? 1 : "none", marginBottom: isTable ? 16 : 42 }}>
          {editor && (
            <div style={{ padding: "8px", borderBottom: "1px solid #ddd", background: "#f5f5f5", display: "flex", gap: "4px", flexWrap: "wrap" }}>
              <button onClick={() => editor.chain().focus().toggleBold().run()} style={{ ...btnSecondary, padding: "4px 8px" }} disabled={!editor.can().chain().focus().toggleBold().run()}>B</button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} style={{ ...btnSecondary, padding: "4px 8px" }} disabled={!editor.can().chain().focus().toggleItalic().run()}>I</button>
              <button onClick={() => editor.chain().focus().toggleStrike().run()} style={{ ...btnSecondary, padding: "4px 8px" }} disabled={!editor.can().chain().focus().toggleStrike().run()}>S</button>
              <div style={{ width: 1, backgroundColor: '#ddd', margin: '0 4px' }} />
              <button onClick={() => editor.chain().focus().setFontSize('12px').run()} style={{ ...btnSecondary, padding: "4px 8px" }}>小</button>
              <button onClick={() => editor.chain().focus().setFontSize('16px').run()} style={{ ...btnSecondary, padding: "4px 8px" }}>中</button>
              <button onClick={() => editor.chain().focus().setFontSize('24px').run()} style={{ ...btnSecondary, padding: "4px 8px" }}>大</button>
              <button onClick={() => editor.chain().focus().setFontSize('32px').run()} style={{ ...btnSecondary, padding: "4px 8px" }}>特大</button>
              <div style={{ width: 1, backgroundColor: '#ddd', margin: '0 4px' }} />
              <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} style={{ ...btnSecondary, padding: "4px 8px" }}>表挿入</button>
              <button onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().addColumnAfter()} style={{ ...btnSecondary, padding: "4px 8px" }}>列追加</button>
              <button onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().addRowAfter()} style={{ ...btnSecondary, padding: "4px 8px" }}>行追加</button>
              <button onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.can().deleteColumn()} style={{ ...btnSecondary, padding: "4px 8px" }}>列削除</button>
              <button onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.can().deleteRow()} style={{ ...btnSecondary, padding: "4px 8px" }}>行削除</button>
              <button onClick={() => editor.chain().focus().deleteTable().run()} disabled={!editor.can().deleteTable()} style={{ ...btnSecondary, padding: "4px 8px" }}>表削除</button>
              <div style={{ width: 1, backgroundColor: '#ddd', margin: '0 4px' }} />
              <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#fecaca').run()} disabled={!editor.can().setCellAttribute('backgroundColor', '#fecaca')} style={{ ...btnSecondary, padding: "4px 8px", backgroundColor: "#fecaca" }}>赤</button>
              <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#bfdbfe').run()} disabled={!editor.can().setCellAttribute('backgroundColor', '#bfdbfe')} style={{ ...btnSecondary, padding: "4px 8px", backgroundColor: "#bfdbfe" }}>青</button>
              <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#bbf7d0').run()} disabled={!editor.can().setCellAttribute('backgroundColor', '#bbf7d0')} style={{ ...btnSecondary, padding: "4px 8px", backgroundColor: "#bbf7d0" }}>緑</button>
              <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#fef08a').run()} disabled={!editor.can().setCellAttribute('backgroundColor', '#fef08a')} style={{ ...btnSecondary, padding: "4px 8px", backgroundColor: "#fef08a" }}>黄</button>
              <button onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', '#ffffff').run()} disabled={!editor.can().setCellAttribute('backgroundColor', '#ffffff')} style={{ ...btnSecondary, padding: "4px 8px" }}>白</button>
              <div style={{ width: 1, backgroundColor: '#ddd', margin: '0 4px' }} />
              <button onClick={() => setShowAiModal(true)} style={{ ...btnSecondary, padding: "4px 8px", color: COLORS.accent, borderColor: COLORS.accent }}>✨ AI アシスト</button>
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Size controls */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 14,
            alignItems: "center",
          }}
        >
          <label
            style={{
              color: COLORS.textMuted,
              fontSize: 11,
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            W
            <input
              type="number"
              step={40}
              min={40}
              value={width}
              onChange={(e) => setWidth(snap(+e.target.value || 40))}
              style={inputStyle}
            />
          </label>
          <label
            style={{
              color: COLORS.textMuted,
              fontSize: 11,
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            H
            <input
              type="number"
              step={40}
              min={40}
              value={height}
              onChange={(e) => setHeight(snap(+e.target.value || 40))}
              style={inputStyle}
            />
          </label>
          <span
            style={{
              marginLeft: "auto",
              color: COLORS.textDim,
              fontSize: 10,
              fontFamily: "monospace",
            }}
          >
            Esc で閉じる / ⌘S で保存
          </span>
        </div>

        <div
          style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}
        >
          <button onClick={onClose} style={btnSecondary}>
            キャンセル
          </button>
          <button
            onClick={() => onSave({ ...node, text: editor ? editor.getHTML() : text, width, height })}
            style={btnPrimary}
          >
            保存
          </button>
        </div>
      </div>

      {showAiModal && (
        <AiChatModal
          node={{ ...node, text: editor ? editor.getHTML() : text }}
          onApply={(updatedNode) => {
            if (editor) {
              editor.commands.setContent(updatedNode.text);
            }
            setShowAiModal(false);
          }}
          onClose={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
}

const inputStyle = {
  width: 64,
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  padding: "3px 6px",
  color: COLORS.text,
  fontFamily: "monospace",
  fontSize: 11,
  outline: "none",
};

const btnPrimary = {
  padding: "7px 18px",
  background: COLORS.accent,
  border: "none",
  borderRadius: 6,
  color: "#fff",
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const btnSecondary = {
  padding: "7px 18px",
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  color: COLORS.textMuted,
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

// ── Drawio Modal ─────────────────────────────────────────────────────────────
function DrawioModal({ node, onSave, onClose }) {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);

  // If the node was AI updated, we clear the flag here since we are opening it


  useEffect(() => {
    const handleMessage = (e) => {
      if (typeof e.data === "string" && e.data.length > 0) {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === "init") {
            setLoading(false);
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({
                action: "load",
                autosave: 1,
                xml: node.xml || "",
              }),
              "*"
            );
          } else if (msg.event === "save") {
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({
                action: "export",
                format: "xmlsvg",
                spin: "Saving...",
              }),
              "*"
            );
          } else if (msg.event === "export") {
            const newNodeState = { ...node, xml: msg.xml, svg: msg.data };
            delete newNodeState.aiUpdated; // clear flag on successful save
            onSave(newNodeState);
            iframeRef.current.contentWindow.postMessage(
              JSON.stringify({ action: "status", message: "Saved", modified: false }),
              "*"
            );
          } else if (msg.event === "exit") {
            onClose();
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [node, onSave, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "90vw",
          height: "90vh",
          background: COLORS.surface,
          borderRadius: 8,
          border: `1px solid ${COLORS.border}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          boxShadow: `0 24px 80px rgba(0,0,0,0.8)`,
        }}
      >
        <div style={{ padding: "8px 16px", background: COLORS.bg, display: "flex", alignItems: "center", borderBottom: `1px solid ${COLORS.border}` }}>
          <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>Draw.io Editor</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ ...btnSecondary, padding: "4px 12px", fontSize: 11 }}>閉じる</button>
        </div>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: COLORS.textMuted }}>
            Loading draw.io...
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="https://embed.diagrams.net/?embed=1&ui=atlas&spin=1&proto=json"
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Drawio"
        />
      </div>
    </div>
  );
}

// ── JSON Panel ───────────────────────────────────────────────────────────────
function JsonPanel({ nodes, onClose }) {
  const json = JSON.stringify({ nodes }, null, 2);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 24,
          width: 640,
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: `0 24px 80px rgba(0,0,0,0.8)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 12,
            gap: 8,
          }}
        >
          <span
            style={{
              color: COLORS.text,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            JSON Canvas Export
          </span>
          <button onClick={copy} style={{ ...btnPrimary, marginLeft: "auto", padding: "5px 14px", fontSize: 11 }}>
            {copied ? "✓ コピー済" : "コピー"}
          </button>
          <button onClick={onClose} style={{ ...btnSecondary, padding: "5px 14px", fontSize: 11 }}>
            閉じる
          </button>
        </div>
        <pre
          style={{
            flex: 1,
            overflow: "auto",
            background: COLORS.bg,
            borderRadius: 6,
            padding: 16,
            color: "#a8d8a8",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            lineHeight: 1.7,
            margin: 0,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {json}
        </pre>
      </div>
    </div>
  );
}

// ── Templates System ─────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "wbs",
    name: "WBS (作業分解構成図)",
    description: "標準的なWBS。大項目・中項目・小項目・担当・期限を管理。",
    nodes: [
      { type: "text", title: "プロジェクト WBS", text: "<h2>プロジェクト名: [ここに入力]</h2><p>概要: ...</p>", x: 0, y: 0, width: 800, height: 100 },
      { type: "table", title: "WBS タスク一覧", text: `<table style="min-width: 75px"><tbody><tr><td colspan="1" rowspan="1"><p><strong>ID</strong></p></td><td colspan="1" rowspan="1"><p><strong>タスク名</strong></p></td><td colspan="1" rowspan="1"><p><strong>担当者</strong></p></td><td colspan="1" rowspan="1"><p><strong>開始日</strong></p></td><td colspan="1" rowspan="1"><p><strong>終了日</strong></p></td><td colspan="1" rowspan="1"><p><strong>ステータス</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p>1.0</p></td><td colspan="1" rowspan="1"><p>要件定義</p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p>未着手</p></td></tr><tr><td colspan="1" rowspan="1"><p>1.1</p></td><td colspan="1" rowspan="1"><p>要件ヒアリング</p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr></tbody></table>`, x: 0, y: 120, width: 800, height: 280 }
    ]
  },
  {
    id: "kanban",
    name: "カンバンボード",
    description: "To Do / In Progress / Done の3列カンバンボード。",
    nodes: [
      { type: "text", title: "ボード名", text: "<h2>スプリント バックログ</h2>", x: 0, y: 0, width: 920, height: 80 },
      { type: "text", title: "To Do", text: "<p>・タスクA</p><p>・タスクB</p>", x: 0, y: 100, width: 280, height: 400 },
      { type: "text", title: "In Progress (進行中)", text: "<p>・タスクC</p>", x: 320, y: 100, width: 280, height: 400 },
      { type: "text", title: "Done (完了)", text: "<p>・タスクD</p>", x: 640, y: 100, width: 280, height: 400 }
    ]
  },
  {
    id: "operation_design",
    name: "運用設計書",
    description: "システムの運用体制、連絡網、障害フローを記述するテンプレート。",
    nodes: [
      { type: "text", title: "運用設計書", text: "<h1>【システム名】運用設計書</h1><p>第1.0版</p>", x: 0, y: 0, width: 840, height: 120 },
      { type: "table", title: "1. 運用体制・連絡網", text: `<table style="min-width: 75px"><tbody><tr><td colspan="1" rowspan="1"><p><strong>役割</strong></p></td><td colspan="1" rowspan="1"><p><strong>担当部署/氏名</strong></p></td><td colspan="1" rowspan="1"><p><strong>連絡先</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p>システム管理者</p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p>インフラ保守</p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr></tbody></table>`, x: 0, y: 140, width: 400, height: 200 },
      { type: "text", title: "2. 障害対応フロー", text: "<h3>障害検知時のエスカレーション手順</h3><ol><li>アラート検知</li><li>一次切り分け（インフラ保守）</li><li>システム管理者へエスカレーション</li></ol>", x: 440, y: 140, width: 400, height: 200 },
      { type: "text", title: "3. 日次/週次 作業一覧", text: "<ul><li>[日次] ログローテーション死活監視</li><li>[週次] バックアップ正常性確認</li></ul>", x: 0, y: 360, width: 840, height: 200 }
    ]
  },
  {
    id: "project_plan",
    name: "プロジェクト計画書",
    description: "プロジェクトの目的、スコープ、体制図を定義する計画書テンプレート。",
    nodes: [
      { type: "text", title: "プロジェクト計画書", text: "<h1>【PJ名】プロジェクト計画書</h1><p>作成日: YYYY/MM/DD</p>", x: 0, y: 0, width: 840, height: 120 },
      { type: "text", title: "1. プロジェクトの目的と背景", text: "<p>ここにプロジェクトの背景と達成すべき目標を記述します。</p>", x: 0, y: 140, width: 400, height: 200 },
      { type: "text", title: "2. 対象スコープ", text: "<p><strong>対象機能:</strong> ...</p><p><strong>対象外 (Out of Scope):</strong> ...</p>", x: 440, y: 140, width: 400, height: 200 },
      { type: "table", title: "3. マイルストーン", text: `<table style="min-width: 75px"><tbody><tr><td colspan="1" rowspan="1"><p><strong>フェーズ</strong></p></td><td colspan="1" rowspan="1"><p><strong>目標時期</strong></p></td></tr><tr><td colspan="1" rowspan="1"><p>要件定義完了</p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p>基本設計完了</p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p>UAT・リリース</p></td><td colspan="1" rowspan="1"><p></p></td></tr></tbody></table>`, x: 0, y: 360, width: 400, height: 240 },
      { type: "text", title: "4. 体制図 (プレースホルダー)", text: "<p>ここにチーム体制図（Drawioノードなど）を配置します。</p>", x: 440, y: 360, width: 400, height: 240 }
    ]
  }
];

function TemplateModal({ onSelect, onClose }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, backdropFilter: "blur(4px)"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: 24, width: 800, maxWidth: "90vw", maxHeight: "80vh",
          display: "flex", flexDirection: "column", boxShadow: `0 24px 80px rgba(0,0,0,0.2)`
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: COLORS.text }}>テンプレートから追加</h2>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={btnSecondary}>閉じる</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 8 }}>
          {TEMPLATES.map(tpl => (
            <div
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              style={{
                border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16,
                cursor: "pointer", transition: "all 0.15s", background: "#fff",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = COLORS.accent;
                e.currentTarget.style.boxShadow = `0 4px 12px ${COLORS.shadow}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <h3 style={{ margin: "0 0 8px 0", fontSize: 15, color: COLORS.accent }}>{tpl.name}</h3>
              <p style={{ margin: 0, fontSize: 13, color: COLORS.textMuted }}>{tpl.description}</p>
              <div style={{ marginTop: 12, fontSize: 11, color: COLORS.textDim, fontFamily: "monospace" }}>
                構成ノード数: {tpl.nodes.length}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AI System ───────────────────────────────────────────────────────────────
function getAiSettings() {
  try {
    const raw = localStorage.getItem('ai_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.provider) parsed.provider = 'openai';
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse ai_settings', err);
  }
  return { provider: 'openai', apiKey: '', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' };
}

function saveAiSettings(s) {
  localStorage.setItem('ai_settings', JSON.stringify(s));
}

async function aiComplete(prompt, contextContent, isXml) {
  const settings = getAiSettings();
  if (!settings.apiKey) {
    throw new Error('※AI設定からAPIキーを入力してください。');
  }

  const systemMsg = isXml
    ? 'You are an assistant that modifies draw.io mxGraphModel XML. Return only the modified XML.'
    : 'You are an assistant that edits HTML content. Return only the modified HTML. Keep existing styles.';

  if (settings.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model || 'gemini-2.5-flash'}:generateContent?key=${settings.apiKey}`;
    const body = {
      system_instruction: {
        parts: [{ text: systemMsg }]
      },
      contents: [{
        parts: [{ text: `Current content:\n${contextContent}\n\nInstruction: ${prompt}` }]
      }],
      generationConfig: {
        temperature: 0.3
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini APIエラー (${resp.status}): ${errText.slice(0, 200)}`);
    }

    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || contextContent;
  }

  const body = {
    model: settings.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: `Current content:\n${contextContent}\n\nInstruction: ${prompt}` }
    ],
    temperature: 0.3,
  };

  const resp = await fetch(settings.endpoint || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`APIエラー (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || contextContent;
}

// ── AI Settings Modal ─────────────────────────────────────────────────────────
function AiSettingsModal({ onClose }) {
  const [settings, setSettings] = useState(() => {
    const s = getAiSettings();
    if (!s.provider) s.provider = 'openai';
    return s;
  });

  const handleProviderChange = (e) => {
    const provider = e.target.value;
    const newSettings = { ...settings, provider };
    if (provider === 'gemini') {
      newSettings.model = 'gemini-2.5-flash';
      newSettings.endpoint = ''; // unused for gemini
    } else if (provider === 'openai') {
      newSettings.model = 'gpt-4o-mini';
      newSettings.endpoint = 'https://api.openai.com/v1/chat/completions';
    }
    setSettings(newSettings);
  };

  const handleSave = () => {
    saveAiSettings(settings);
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 16 }}>⚙️</span>
          <span style={{ color: COLORS.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 700 }}>AI 設定</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>プロバイダ</span>
            <select
              value={settings.provider}
              onChange={handleProviderChange}
              style={{ ...inputStyle, width: '100%', padding: '8px 12px', fontSize: 13, backgroundColor: COLORS.bg }}
            >
              <option value="openai">OpenAI互換 (ChatGPT, Claude等)</option>
              <option value="gemini">Google Gemini</option>
              <option value="custom">カスタム</option>
            </select>
          </label>

          {(settings.provider === 'openai' || settings.provider === 'custom') && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>API エンドポイント</span>
              <input
                type="text"
                value={settings.endpoint}
                onChange={(e) => setSettings({ ...settings, endpoint: e.target.value })}
                placeholder="https://api.openai.com/v1/chat/completions"
                style={{ ...inputStyle, width: '100%', padding: '8px 12px', fontSize: 13 }}
              />
            </label>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>API キー</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder={settings.provider === 'gemini' ? "AIzaSy..." : "sk-..."}
              style={{ ...inputStyle, width: '100%', padding: '8px 12px', fontSize: 13 }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textMuted }}>モデル名</span>
            <input
              type="text"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              placeholder={settings.provider === 'gemini' ? "gemini-2.5-flash" : "gpt-4o-mini"}
              style={{ ...inputStyle, width: '100%', padding: '8px 12px', fontSize: 13 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <button onClick={onClose} style={{ ...btnSecondary, padding: '8px 20px' }}>キャンセル</button>
          <button onClick={handleSave} style={{ ...btnPrimary, padding: '8px 20px' }}>保存</button>
        </div>
      </div>
    </div>
  );
}

// ── AI Chat Modal ────────────────────────────────────────────────────────────
function AiChatModal({ node, onApply, onClose }) {
  const isXml = node.type === "file";
  const [messages, setMessages] = useState([{ role: "system", content: "ノードの編集アシスタントです。どう変更しますか？" }]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewContent, setPreviewContent] = useState(isXml ? (node.xml || "") : node.text);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsGenerating(true);

    try {
      const resultContent = await aiComplete(userMsg, previewContent, isXml);
      setPreviewContent(resultContent);
      setMessages(prev => [...prev, { role: "ai", content: "結果をプレビューに反映しました。適用しますか？" }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "system", content: err.message || "エラーが発生しました。" }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    if (isXml) {
      onApply({ ...node, xml: previewContent, aiUpdated: true, svg: null });
    } else {
      onApply({ ...node, text: previewContent });
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 24,
          width: 800,
          maxWidth: "90vw",
          height: "80vh",
          display: "flex",
          gap: 24,
          boxShadow: `0 24px 80px rgba(0,0,0,0.2)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: `1px solid ${COLORS.border}`, paddingRight: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <span style={{ color: COLORS.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 600 }}>AI アシスト</span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setShowAiSettings(true)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11 }}>⚙️ 設定</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16, paddingRight: 8 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: msg.role === "user" ? COLORS.accentSoft : msg.role === "system" ? COLORS.bg : "#fdfde3", color: msg.role === "user" ? COLORS.accent : COLORS.text, padding: "8px 12px", borderRadius: 8, fontSize: 13, border: `1px solid ${msg.role === "user" ? COLORS.borderActive : COLORS.border}`, whiteSpace: "pre-wrap" }}>
                {msg.content}
              </div>
            ))}
            {isGenerating && (
              <div style={{ alignSelf: "flex-start", color: COLORS.textMuted, fontSize: 12, fontStyle: "italic" }}>AIが考えています...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="AIに指示する..."
              disabled={isGenerating}
              style={{ flex: 1, ...inputStyle, fontSize: 13, padding: "8px 12px" }}
            />
            <button onClick={handleSend} disabled={isGenerating || !input.trim()} style={{ ...btnPrimary, padding: "8px 16px" }}>送信</button>
          </div>
        </div>

        {/* Right: Preview & Controls */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <span style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: 600 }}>プレビュー</span>
            <div style={{ flex: 1 }} />
            <span style={{ color: COLORS.textDim, fontSize: 10, fontFamily: "monospace" }}>id: {node.id}</span>
          </div>

          <div className="ProseMirror" style={{ flex: 1, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16, overflowY: "auto", color: COLORS.text }}>
            {node.type === "file" ? (
              <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", color: COLORS.textMuted }}>
                {previewContent}
              </pre>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: previewContent }} />
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={btnSecondary}>キャンセル</button>
            <button onClick={handleApply} style={{ ...btnPrimary, background: "#10b981" }}>適用 (Apply)</button>
          </div>
        </div>
      </div>
      {showAiSettings && <AiSettingsModal onClose={() => setShowAiSettings(false)} />}
    </div>
  );
}

// ── Main Editor ──────────────────────────────────────────────────────────────
export default function CanvasEditor() {
  const [history, setHistory] = useState({
    past: [],
    present: [{ id: "page_1", name: "Page 1", nodes: INITIAL_NODES }],
    future: []
  });

  const pages = history.present;
  const [activePageId, setActivePageId] = useState("page_1");

  const activePage = pages.find((p) => p.id === activePageId) || pages[0];
  const nodes = activePage.nodes;

  const commitHistory = useCallback(() => {
    setHistory(curr => {
      const newPast = [...curr.past, curr.present];
      if (newPast.length > 50) newPast.shift();
      return { ...curr, past: newPast, future: [] };
    });
  }, []);

  const setPages = useCallback((action, options = { recordHistory: true }) => {
    setHistory(curr => {
      const newPresent = typeof action === "function" ? action(curr.present) : action;
      if (newPresent === curr.present) return curr;

      if (!options.recordHistory) {
        return { ...curr, present: newPresent };
      }

      const newPast = [...curr.past, curr.present];
      if (newPast.length > 50) newPast.shift(); // 50 items limit
      return {
        past: newPast,
        present: newPresent,
        future: []
      };
    });
  }, []);

  const setNodes = useCallback((action, options = { recordHistory: true }) => {
    setPages((prevPages) =>
      prevPages.map((p) => {
        if (p.id === activePageId) {
          const newNodes = typeof action === "function" ? action(p.nodes) : action;
          return { ...p, nodes: newNodes };
        }
        return p;
      }),
      options
    );
  }, [activePageId, setPages]);

  const undo = useCallback(() => {
    setHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [curr.present, ...curr.future]
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      return {
        past: [...curr.past, curr.present],
        present: next,
        future: newFuture
      };
    });
  }, []);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [aiAssistNode, setAiAssistNode] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isA4Mode, setIsA4Mode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isAutoReflow, setIsAutoReflow] = useState(true);

  const effectiveWidth = isA4Mode ? 800 : CANVAS_WIDTH;
  const effectiveHeight = isA4Mode ? 1120 : CANVAS_HEIGHT;

  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const panRef = useRef(null);
  const canvasRef = useRef(null);
  const clipboardRef = useRef(null);

  // ── Push Reflow Helper ──
  const resolvePushReflow = useCallback((originals, drafts) => {
    let current = JSON.parse(JSON.stringify(drafts));
    let movedThisRound = true;
    let iterations = 0;
    while (movedThisRound && iterations < 10) {
      movedThisRound = false;
      iterations++;

      for (let i = 0; i < current.length; i++) {
        for (let j = 0; j < current.length; j++) {
          if (i === j) continue;
          const a = current[i];
          const b = current[j];

          const intersectX = (a.x < b.x + b.width) && (a.x + a.width > b.x);
          const intersectY = (a.y < b.y + b.height) && (a.y + a.height > b.y);

          if (intersectX && intersectY) {
            const origA = originals.find(o => o.id === a.id) || a;
            const origB = originals.find(o => o.id === b.id) || b;

            const margin = Math.min(origA.width, origA.height, GRID_SIZE) / 2;
            const wasStrictRight = origB.x >= origA.x + origA.width - margin;
            const wasStrictBelow = origB.y >= origA.y + origA.height - margin;

            let pushed = false;
            if (wasStrictRight && !wasStrictBelow) {
              const newX = snap(a.x + a.width);
              if (b.x !== newX) { b.x = newX; pushed = true; }
            } else if (wasStrictBelow && !wasStrictRight) {
              const newY = snap(a.y + a.height);
              if (b.y !== newY) { b.y = newY; pushed = true; }
            } else if (wasStrictRight && wasStrictBelow) {
              const newX = snap(a.x + a.width);
              if (b.x !== newX) { b.x = newX; pushed = true; }
            } else {
              const cAX = origA.x + origA.width / 2;
              const cBX = origB.x + origB.width / 2;
              const cAY = origA.y + origA.height / 2;
              const cBY = origB.y + origB.height / 2;

              if (cBX >= cAX && (cBX - cAX) >= Math.abs(cBY - cAY)) {
                const newX = snap(a.x + a.width);
                if (b.x !== newX) { b.x = newX; pushed = true; }
              } else if (cBY >= cAY && (cBY - cAY) > Math.abs(cBX - cAX)) {
                const newY = snap(a.y + a.height);
                if (b.y !== newY) { b.y = newY; pushed = true; }
              }
            }
            if (pushed) movedThisRound = true;
          }
        }
      }
    }

    if (isA4Mode) {
      current.forEach(n => {
        n.x = Math.max(0, Math.min(n.x, effectiveWidth - n.width));
        n.y = Math.max(0, Math.min(n.y, effectiveHeight - n.height));
      });
    }
    return current;
  }, [isA4Mode, effectiveWidth, effectiveHeight]);

  // ── Selection ──
  const handleSelect = useCallback((id, shift) => {
    setSelectedIds((prev) =>
      shift ? (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]) : [id]
    );
  }, []);

  const handleCanvasClick = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const addPage = () => {
    const newId = genId("page");
    setPages((prev) => [...prev, { id: newId, name: `Page ${prev.length + 1}`, nodes: [] }]);
    setActivePageId(newId);
    setSelectedIds([]);
  };

  const renamePage = (id, newName) => {
    setPages((prev) => prev.map((p) => p.id === id ? { ...p, name: newName } : p));
  };

  // ── Drag ──
  const handleDragStart = useCallback(
    (e, id, shiftKey) => {
      commitHistory();
      let draggingIds = selectedIds;
      if (shiftKey) {
        draggingIds = selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id];
      } else if (!selectedIds.includes(id)) {
        draggingIds = [id];
      }

      const draggingNodes = nodes
        .filter(n => draggingIds.includes(n.id))
        .map(n => ({ id: n.id, startX: n.x, startY: n.y }));

      dragRef.current = {
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        nodes: draggingNodes,
      };
    },
    [nodes, selectedIds, commitHistory]
  );

  // ── Resize ──
  const handleResizeStart = useCallback(
    (e, id) => {
      commitHistory();
      const node = nodes.find((n) => n.id === id);
      resizeRef.current = {
        id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startW: node.width,
        startH: node.height,
        originalNodes: JSON.parse(JSON.stringify(nodes)),
      };
    },
    [nodes, commitHistory]
  );

  // ── Pan ──
  const handleCanvasMouseDown = useCallback((e) => {
    // Middle-click or Alt+left-click: always pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      panRef.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y };
      setIsPanning(true);
      return;
    }
    // Left-click on empty canvas: pan if no node drag/resize is starting
    // A short delay allows node drag handlers to claim the event first
    if (e.button === 0 && !dragRef.current && !resizeRef.current) {
      panRef.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y };
      setIsPanning(true);
    }
  }, [pan]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (dragRef.current) {
        const { startMouseX, startMouseY, nodes: draggingNodes } = dragRef.current;
        const dx = (e.clientX - startMouseX) / zoom;
        const dy = (e.clientY - startMouseY) / zoom;

        // Calculate new positions for all dragged nodes
        const updates = new Map();
        draggingNodes.forEach((dn) => {
          let finalX = snap(dn.startX + dx);
          let finalY = snap(dn.startY + dy);

          if (isA4Mode) {
            const node = nodes.find(n => n.id === dn.id);
            if (node) {
              finalX = Math.max(0, Math.min(finalX, effectiveWidth - node.width));
              finalY = Math.max(0, Math.min(finalY, effectiveHeight - node.height));
            }
          }
          updates.set(dn.id, { x: finalX, y: finalY });
        });

        setNodes((prev) =>
          prev.map((n) => {
            if (updates.has(n.id)) {
              return { ...n, ...updates.get(n.id) };
            }
            return n;
          }),
          { recordHistory: false }
        );
      }
      if (resizeRef.current) {
        const { id, startMouseX, startMouseY, startW, startH, originalNodes } = resizeRef.current;
        const dx = (e.clientX - startMouseX) / zoom;
        const dy = (e.clientY - startMouseY) / zoom;
        let newW = Math.max(GRID_SIZE, snap(startW + dx));
        let newH = Math.max(GRID_SIZE, snap(startH + dy));

        setNodes((prev) => {
          let draftNodes = originalNodes.map((n) => {
            if (n.id === id) {
              let finalW = newW;
              let finalH = newH;
              if (isA4Mode) {
                finalW = Math.max(GRID_SIZE, Math.min(finalW, effectiveWidth - n.x));
                finalH = Math.max(GRID_SIZE, Math.min(finalH, effectiveHeight - n.y));
              }
              return { ...n, width: finalW, height: finalH };
            }
            return { ...n };
          });

          if (isAutoReflow) {
            draftNodes = resolvePushReflow(originalNodes, draftNodes);
          }
          return draftNodes;
        }, { recordHistory: false });
      }
      if (panRef.current) {
        setPan({
          x: e.clientX - panRef.current.startX,
          y: e.clientY - panRef.current.startY,
        });
      }
    };
    const onMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      panRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [zoom, pan, isA4Mode, effectiveWidth, effectiveHeight, setNodes, nodes, isAutoReflow, resolvePushReflow]);

  // ── Zoom ──
  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.min(3, Math.max(0.2, z * delta)));
    },
    []
  );

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Keyboard ──
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if (editingNode || showJson) return;

      // Undo / Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (e.key.toLowerCase() === "y") {
          redo();
          return;
        }
      }

      // Copy & Paste
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const copied = nodes.filter(n => selectedIds.includes(n.id));
        if (copied.length > 0) {
          clipboardRef.current = JSON.parse(JSON.stringify(copied));
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (clipboardRef.current && clipboardRef.current.length > 0) {
          const newNodes = clipboardRef.current.map(n => ({
            ...n,
            id: genId(n.type),
            x: n.x + GRID_SIZE,
            y: n.y + GRID_SIZE
          }));
          setNodes(prev => [...prev, ...newNodes]);
          setSelectedIds(newNodes.map(n => n.id));
          clipboardRef.current = JSON.parse(JSON.stringify(newNodes)); // cascade paste offsets
        }
      }

      // Delete Nodes
      if (e.key === "Delete" || e.key === "Backspace") {
        setNodes((prev) => prev.filter((n) => !selectedIds.includes(n.id)));
        setSelectedIds([]);
      }

      // Deselect
      if (e.key === "Escape") setSelectedIds([]);

      // Move Nodes (Arrow Keys)
      const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
      if (isArrow && selectedIds.length > 0) {
        e.preventDefault();

        // ── Row Insert / Delete Mode ──
        if (e.shiftKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
          const dy = e.key === "ArrowDown" ? GRID_SIZE : -GRID_SIZE;
          const selectedNodes = nodes.filter(n => selectedIds.includes(n.id));
          // Find the lowest Y coordinate among selected nodes to act as the "split" point
          const baseY = Math.min(...selectedNodes.map(n => n.y));

          setNodes(prev => prev.map(n => {
            // If the node is exactly at or below the split point, move it.
            if (n.y >= baseY) {
              let newY = n.y + dy;
              if (isA4Mode) {
                newY = Math.max(0, Math.min(newY, effectiveHeight - n.height));
              }
              return { ...n, y: newY };
            }
            return n;
          }));
          return;
        }

        // ── Standard Arrow Key Movement ──
        let dx = 0, dy = 0;
        if (e.key === "ArrowUp") dy = -GRID_SIZE;
        if (e.key === "ArrowDown") dy = GRID_SIZE;
        if (e.key === "ArrowLeft") dx = -GRID_SIZE;
        if (e.key === "ArrowRight") dx = GRID_SIZE;

        setNodes(prev => prev.map(n => {
          if (selectedIds.includes(n.id)) {
            let finalX = n.x + dx;
            let finalY = n.y + dy;
            if (isA4Mode) {
              finalX = Math.max(0, Math.min(finalX, effectiveWidth - n.width));
              finalY = Math.max(0, Math.min(finalY, effectiveHeight - n.height));
            }
            return { ...n, x: finalX, y: finalY };
          }
          return n;
        }));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nodes, selectedIds, editingNode, showJson, isA4Mode, effectiveWidth, effectiveHeight, undo, redo, zoom, pan, setNodes]);

  // ── Add nodes ──
  const addTextNode = () => {
    const newNode = {
      id: genId("text"),
      type: "text",
      title: "",
      text: "<p>新しいテキスト</p>",
      x: snap(80 - pan.x / zoom),
      y: snap(80 - pan.y / zoom),
      width: 280,
      height: 120,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedIds([newNode.id]);
  };

  const addFileNode = () => {
    const newNode = {
      id: genId("file"),
      type: "file",
      title: "",
      file: "assets/new_diagram.drawio.svg",
      x: snap(120 - pan.x / zoom),
      y: snap(120 - pan.y / zoom),
      width: 320,
      height: 200,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedIds([newNode.id]);
  };

  const addImageNode = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newNode = {
          id: genId("image"),
          type: "image",
          title: "",
          imageData: ev.target.result,
          x: snap(120 - pan.x / zoom),
          y: snap(120 - pan.y / zoom),
          width: 320,
          height: 240,
        };
        setNodes((prev) => [...prev, newNode]);
        setSelectedIds([newNode.id]);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const addTableNode = () => {
    const newNode = {
      id: genId("table"),
      type: "table",
      title: "",
      text: `<table style="min-width: 75px"><tbody><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr></tbody></table>`,
      x: snap(160 - pan.x / zoom),
      y: snap(160 - pan.y / zoom),
      width: 400,
      height: 200,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedIds([newNode.id]);
  };

  const instantiateTemplate = (template) => {
    setShowTemplateModal(false);

    const newPageId = genId("page");
    const newPageName = template.name;

    // Position nodes predictably at the top-left (40, 40) of the new page
    const offsetX = 40;
    const offsetY = 40;

    const newNodes = template.nodes.map(n => ({
      ...n,
      id: genId(n.type),
      x: snap(n.x + offsetX),
      y: snap(n.y + offsetY)
    }));

    setHistory(curr => {
      const newPage = { id: newPageId, name: newPageName, nodes: newNodes };
      const newPresent = [...curr.present, newPage];
      const newPast = [...curr.past, curr.present];
      if (newPast.length > 50) newPast.shift();

      return {
        past: newPast,
        present: newPresent,
        future: []
      };
    });

    setActivePageId(newPageId);
    setSelectedIds([]); // Clear selection to present a clean new page
  };

  // ── Edit ──
  const handleDoubleClick = useCallback((node) => {
    setEditingNode(node);
  }, []);

  const handleSaveEdit = useCallback((updated) => {
    setNodes((prev) => {
      let draftNodes = prev.map((n) => (n.id === updated.id ? updated : n));
      if (isAutoReflow) {
        draftNodes = resolvePushReflow(prev, draftNodes);
      }
      return draftNodes;
    });
    setEditingNode(null);
  }, [setNodes, isAutoReflow, resolvePushReflow]);

  // ── Coordinate info & Selections ──
  const selectedNode = nodes.find((n) => selectedIds[0] === n.id);
  const selectedNodeObjects = nodes.filter(n => selectedIds.includes(n.id));

  // Derive common title among selected nodes
  let commonTitle = "";
  let mixedTitles = false;
  if (selectedNodeObjects.length > 0) {
    const firstTitle = selectedNodeObjects[0].title || "";
    if (selectedNodeObjects.every(n => (n.title || "") === firstTitle)) {
      commonTitle = firstTitle;
    } else {
      mixedTitles = true;
    }
  }

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setNodes(prev => prev.map(n => {
      if (selectedIds.includes(n.id)) {
        return { ...n, title: newTitle };
      }
      return n;
    }));
  };

  let commonLink = "";
  let mixedLinks = false;
  if (selectedNodeObjects.length > 0) {
    const firstLink = selectedNodeObjects[0].linkToPageId || "";
    if (selectedNodeObjects.every(n => (n.linkToPageId || "") === firstLink)) {
      commonLink = firstLink;
    } else {
      mixedLinks = true;
    }
  }

  const handleLinkChange = (e) => {
    const newLink = e.target.value;
    setNodes(prev => prev.map(n => {
      if (selectedIds.includes(n.id)) {
        return { ...n, linkToPageId: newLink };
      }
      return n;
    }));
  };

  // ── SVG to PNG Helper ──
  const svgToPngBase64 = (svgString, width, height) => {
    return new Promise((resolve) => {
      const img = new Image();
      // Determine the source URL
      let url;
      let isObjectUrl = false;
      if (svgString.startsWith("data:")) {
        // Already a data URL — use directly
        url = svgString;
      } else {
        // Raw SVG string — wrap in a Blob
        const svg = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        url = URL.createObjectURL(svg);
        isObjectUrl = true;
      }

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const b64 = canvas.toDataURL("image/png");
        if (isObjectUrl) URL.revokeObjectURL(url);
        resolve(b64);
      };
      img.onerror = () => {
        if (isObjectUrl) URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  };

  // ── Excel Export (Rust Backend) ──
  const exportToExcel = async () => {
    try {
      const EXCEL_CELL_SIZE = 20;
      const turndownService = new TurndownService();

      // Prepare the payload for Rust
      const exportPages = [];

      for (const page of pages) {
        const excelNodes = [];

        for (const node of page.nodes) {
          const col = Math.max(0, Math.round(node.x / EXCEL_CELL_SIZE));
          const row = Math.max(0, Math.round(node.y / EXCEL_CELL_SIZE));
          const span_cols = Math.max(1, Math.round((node.width || GRID_SIZE) / EXCEL_CELL_SIZE));
          const span_rows = Math.max(1, Math.round((node.height || GRID_SIZE) / EXCEL_CELL_SIZE));

          // Insert node title one row above the content anchor
          if (node.title && row > 0) {
            excelNodes.push({
              row: row - 1,
              col,
              width_px: 0,
              height_px: 0,
              node_type: "node_title",
              text: node.title,
              base64_image: null,
              span_cols: 1,
              span_rows: 1,
            });
          }

          if (node.type === "text") {
            const text = turndownService.turndown(node.text || "");
            excelNodes.push({
              row,
              col,
              width_px: node.width || GRID_SIZE,
              height_px: node.height || GRID_SIZE,
              node_type: "text",
              text: text,
              base64_image: null,
              span_cols: 1, // No merge — Excel Online bug at AD/AE boundary
              span_rows: 1,
            });
          } else if (node.type === "table") {
            const parser = new DOMParser();
            const doc = parser.parseFromString(node.text || "", "text/html");
            const trs = doc.querySelectorAll("tr");
            const numRows = trs.length;
            if (numRows === 0) continue;

            // Pass 1: build occupancy grid & find logical column count
            const grid = [];
            for (let r = 0; r < numRows; r++) grid[r] = [];
            let logicalNumCols = 0;

            trs.forEach((tr, rIdx) => {
              let c = 0;
              tr.querySelectorAll("td, th").forEach((td) => {
                while (grid[rIdx][c]) c++;
                const rSpan = parseInt(td.getAttribute("rowspan") || "1", 10);
                const cSpan = parseInt(td.getAttribute("colspan") || "1", 10);
                for (let i = 0; i < rSpan; i++) {
                  for (let j = 0; j < cSpan; j++) {
                    if (!grid[rIdx + i]) grid[rIdx + i] = [];
                    grid[rIdx + i][c + j] = true;
                  }
                }
                td._logicalCol = c;
                c += cSpan;
                if (c > logicalNumCols) logicalNumCols = c;
              });
            });

            if (logicalNumCols === 0) continue;

            // Pass 2: proportional sizing — distribute node's pixel area across cells
            const avgCellW = Math.max(1, Math.floor(span_cols / logicalNumCols));
            const avgCellH = Math.max(1, Math.floor(span_rows / numRows));

            trs.forEach((tr, rIdx) => {
              tr.querySelectorAll("td, th").forEach((td) => {
                const cIdx = td._logicalCol;
                const rSpan = parseInt(td.getAttribute("rowspan") || "1", 10);
                const cSpan = parseInt(td.getAttribute("colspan") || "1", 10);

                const cOffset = cIdx * avgCellW;
                const rOffset = rIdx * avgCellH;
                let cellW = avgCellW * cSpan;
                let cellH = avgCellH * rSpan;

                // last col/row absorbs remainder
                if (cIdx + cSpan >= logicalNumCols) cellW = span_cols - cOffset;
                if (rIdx + rSpan >= numRows) cellH = span_rows - rOffset;

                excelNodes.push({
                  row: row + rOffset,
                  col: col + cOffset,
                  width_px: 0,
                  height_px: 0,
                  node_type: td.tagName.toLowerCase() === "th" ? "table_th" : "table_cell",
                  text: turndownService.turndown(td.innerHTML),
                  base64_image: null,
                  span_cols: Math.max(1, cellW),
                  span_rows: Math.max(1, cellH),
                });
              });
            });
          } else if (node.type === "file") {
            let b64 = null;
            try {
              if (node.svg) {
                b64 = await svgToPngBase64(node.svg, node.width, node.height);
              } else if (node.file && node.file.startsWith("data:image")) {
                b64 = node.file;
              }
            } catch (e) {
              console.warn("Failed to encode SVG for file node", node.id, e);
            }
            excelNodes.push({
              row,
              col,
              width_px: Math.max(GRID_SIZE, node.width),
              height_px: Math.max(GRID_SIZE, node.height),
              node_type: "file",
              text: null,
              base64_image: b64 || null,
              span_cols,
              span_rows,
            });
          } else if (node.type === "image") {
            let b64 = null;
            if (node.imageData && typeof node.imageData === 'string') {
              if (node.imageData.startsWith("data:")) {
                b64 = node.imageData;
              } else {
                // Assume raw base64, wrap it for safety
                b64 = "data:image/png;base64," + node.imageData;
              }
            }
            excelNodes.push({
              row,
              col,
              width_px: Math.max(GRID_SIZE, node.width),
              height_px: Math.max(GRID_SIZE, node.height),
              node_type: "image",
              text: null,
              base64_image: b64 || null,
              span_cols,
              span_rows,
            });
          }
        }

        exportPages.push({
          name: page.name,
          nodes: excelNodes,
        });
      }

      console.log("Exporting to Excel (to Rust backend):", exportPages);

      // Ask Rust to build the Excel file in memory
      const bytes = await invoke('generate_excel_file', {
        payload: {
          pages: exportPages,
          grid_size: EXCEL_CELL_SIZE,
        }
      });

      console.log("Received byte array from Rust:", bytes.length);

      // Prompt user for save location
      const filePath = await save({
        filters: [{
          name: 'Excel Workbook',
          extensions: ['xlsx']
        }],
        defaultPath: "canvas-layout.xlsx",
      });

      if (filePath) {
        // Rust returns an array of bytes, let's cast it to Uint8Array and save
        const u8Data = new Uint8Array(bytes);
        await writeFile(filePath, u8Data);
      }
    } catch (err) {
      console.error("Excel export failed:", err);
      // alert("Excel出力に失敗しました:\n" + err);
    }
  };

  // ── GCS Save / Load ──
  const saveGcs = async () => {
    try {
      const gcsData = {
        version: 1,
        pages: pages
      };
      const jsonString = JSON.stringify(gcsData);

      const filePath = await save({
        filters: [{
          name: 'GridCanvasStudio Project',
          extensions: ['gcs']
        }],
        defaultPath: "project.gcs",
      });

      if (filePath) {
        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(jsonString));
      }
    } catch (err) {
      console.error("GCS save failed:", err);
      // alert("GCS保存に失敗しました:\n" + err);
    }
  };

  const loadGcs = async () => {
    try {
      const filePath = await open({
        filters: [{
          name: 'GridCanvasStudio Project',
          extensions: ['gcs']
        }],
        multiple: false,
      });

      if (!filePath) return;

      const bytes = await readFile(filePath);
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(bytes);
      const data = JSON.parse(text);

      if (data && data.pages && Array.isArray(data.pages)) {
        setHistory({ past: [], present: data.pages, future: [] });
        if (data.pages.length > 0) {
          setActivePageId(data.pages[0].id);
        }
      } else {
        alert("無効なGCSファイルです。");
      }
    } catch (err) {
      console.error("GCS load failed:", err);
      alert("GCS読込に失敗しました:\n" + err);
    }
  };

  // ── JSON Canvas Save / Load ──
  const exportCanvasDir = async () => {
    try {
      const selectedDir = await open({
        directory: true,
        multiple: false,
        title: "保存先のフォルダを選択",
      });
      if (!selectedDir) return;

      const sep = selectedDir.includes('\\') ? '\\' : '/';
      const assetsDir = selectedDir + sep + 'assets';

      const hasAssets = await exists(assetsDir);
      if (!hasAssets) {
        await mkdir(assetsDir, { recursive: true });
      }

      for (const page of pages) {
        const jsonNodes = [];
        for (const node of page.nodes) {
          if (node.type === 'text' || node.type === 'table') {
            jsonNodes.push({
              id: node.id,
              type: 'text',
              text: node.text,
              x: node.x,
              y: node.y,
              width: node.width,
              height: node.height,
              _gcs_type: node.type,
              ...(node.title ? { _gcs_title: node.title } : {})
            });
          } else if (node.type === 'file' || node.type === 'image') {
            let fileName = `${node.id}`;
            if (node.type === 'file' && node.svg) {
              fileName += '.svg';
              const assetPath = assetsDir + sep + fileName;
              const encoder = new TextEncoder();
              await writeFile(assetPath, encoder.encode(node.svg));
            } else if (node.imageData || node.file) {
              const b64 = node.imageData || node.file;
              const ext = b64.includes('image/jpeg') ? 'jpg' : b64.includes('image/gif') ? 'gif' : 'png';
              fileName += `.${ext}`;

              // Handle Data URI extracting carefully
              let base64Data = b64;
              if (b64.includes(",")) {
                base64Data = b64.split(",")[1];
              }
              // Strip out any newlines or spaces that could cause atob to fail
              base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, "");

              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const assetPath = assetsDir + sep + fileName;
              await writeFile(assetPath, bytes);
            } else {
              fileName += '.png';
            }

            jsonNodes.push({
              id: node.id,
              type: 'file',
              file: `assets/${fileName}`,
              x: node.x,
              y: node.y,
              width: node.width,
              height: node.height,
              _gcs_type: node.type,
              ...(node.title ? { _gcs_title: node.title } : {})
            });
          }
        }

        const canvasObj = {
          nodes: jsonNodes,
          edges: []
        };

        const pageFileName = selectedDir + sep + `${page.name.replace(/[\\/:*?"<>|]/g, '_')}.canvas`;
        const encoder = new TextEncoder();
        await writeFile(pageFileName, encoder.encode(JSON.stringify(canvasObj, null, 2)));
      }

      alert("JSON Canvasフォルダへの出力が完了しました！");
    } catch (err) {
      console.error("Canvas export failed:", err);
      alert("エクスポートに失敗しました:\n" + err);
    }
  };

  const importCanvasDir = async () => {
    try {
      const selectedDir = await open({
        directory: true,
        multiple: false,
        title: "読込対象のフォルダを選択",
      });
      if (!selectedDir) return;

      const sep = selectedDir.includes('\\') ? '\\' : '/';
      const entries = await readDir(selectedDir);
      const canvasFiles = entries.filter(e => e.name && e.name.endsWith('.canvas'));

      if (canvasFiles.length === 0) {
        alert("フォルダ内に .canvas ファイルが見つかりませんでした。");
        return;
      }

      const loadedPages = [];
      const decoder = new TextDecoder('utf-8');

      for (const fileEntry of canvasFiles) {
        const filePath = selectedDir + sep + fileEntry.name;
        const bytes = await readFile(filePath);
        const text = decoder.decode(bytes);
        const canvasData = JSON.parse(text);

        const myNodes = [];
        if (canvasData.nodes && Array.isArray(canvasData.nodes)) {
          for (const n of canvasData.nodes) {
            const internalNode = {
              id: n.id,
              type: n._gcs_type || n.type,
              x: n.x,
              y: n.y,
              width: n.width,
              height: n.height,
              title: n._gcs_title || ""
            };

            if (n.type === 'text') {
              internalNode.text = n.text;
              if (!n._gcs_type && n.text && n.text.trim().startsWith('<table')) {
                internalNode.type = 'table';
              }
            } else if (n.type === 'file' && n.file) {
              const assetPath = selectedDir + sep + n.file.replace('/', sep);
              try {
                const assetBytes = await readFile(assetPath);
                if (n.file.endsWith('.svg')) {
                  internalNode.type = 'file';
                  internalNode.svg = decoder.decode(assetBytes);
                } else {
                  internalNode.type = internalNode.type === 'file' ? 'image' : internalNode.type;
                  const ext = n.file.split('.').pop().toLowerCase();
                  const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : 'image/png';
                  const binaryArr = Array.from(assetBytes);
                  let b64Str = "";
                  for (let i = 0; i < binaryArr.length; i += 8192) {
                    b64Str += String.fromCharCode.apply(null, binaryArr.slice(i, i + 8192));
                  }
                  const b64 = btoa(b64Str);
                  internalNode.imageData = `data:${mime};base64,${b64}`;
                  if (n._gcs_type === 'file') {
                    internalNode.file = internalNode.imageData;
                  }
                }
              } catch (e) {
                console.error("Failed to load asset:", n.file);
                if (n._gcs_type === 'file') {
                  internalNode.svg = "<svg><text>Asset Error</text></svg>";
                }
              }
            }
            myNodes.push(internalNode);
          }
        }

        loadedPages.push({
          id: genId("page"),
          name: fileEntry.name.replace('.canvas', ''),
          nodes: myNodes
        });
      }

      if (loadedPages.length > 0) {
        setHistory({ past: [], present: loadedPages, future: [] });
        setActivePageId(loadedPages[0].id);
      }
    } catch (err) {
      console.error("Canvas import failed:", err);
      alert("インポートに失敗しました:\n" + err);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'IBM Plex Sans', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          height: 52,
          background: COLORS.surface,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 8,
          flexShrink: 0,
          zIndex: 100,
          overflowX: "auto",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 16 }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: COLORS.accent,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="white" />
              <rect x="8" y="1" width="5" height="5" rx="1" fill="white" opacity="0.5" />
              <rect x="1" y="8" width="5" height="5" rx="1" fill="white" opacity="0.5" />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="white" />
            </svg>
          </div>
          <span
            style={{
              color: COLORS.text,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            GridCanvasStudio
          </span>
        </div>

        <div style={{ width: 1, height: 24, background: COLORS.border, margin: "0 4px" }} />

        {/* Add buttons */}
        <ToolButton onClick={addTextNode} title="テキストノード追加">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <text x="3" y="10" fill="currentColor" fontSize="8" fontWeight="700">T</text>
          </svg>
          テキスト
        </ToolButton>

        <ToolButton onClick={addFileNode} title="DrawIOノード追加">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3 5h8M3 7.5h8M3 10h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          DrawIO
        </ToolButton>

        <ToolButton onClick={addImageNode} title="画像ノード追加">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
            <path d="M13 10l-3.5-3.5L2 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          画像
        </ToolButton>

        <ToolButton onClick={addTableNode} title="テーブルノード追加">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1 5.5h12M1 8.5h12M5 2v10M9 2v10" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          表
        </ToolButton>

        <ToolButton onClick={() => setShowTemplateModal(true)} title="テンプレートから追加">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="8" y="1" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <rect x="1" y="7" width="12" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          テンプレート
        </ToolButton>

        <div style={{ width: 1, height: 24, background: COLORS.border, margin: "0 4px" }} />

        {selectedNode && (selectedNode.type === "text" || selectedNode.type === "table" || selectedNode.type === "file") && (
          <button
            onClick={() => setAiAssistNode(selectedNode)}
            style={{
              ...btnSecondary,
              padding: "4px 12px",
              borderColor: COLORS.accent,
              color: COLORS.accent,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span style={{ fontSize: 12 }}>✨</span> AI アシスト
          </button>
        )}

        {selectedIds.length > 0 && (
          <>
            <div style={{ width: 1, height: 24, background: COLORS.border, margin: "0 4px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600 }}>タイトル:</span>
              <input
                type="text"
                value={mixedTitles ? "" : commonTitle}
                placeholder={mixedTitles ? "複数のタイトルが混在..." : "ノード名..."}
                onChange={handleTitleChange}
                style={{
                  ...inputStyle,
                  width: 140,
                  fontSize: 12,
                  padding: "4px 8px",
                  background: mixedTitles ? "#f9fafb" : "#fff"
                }}
              />
            </div>

            <div style={{ width: 1, height: 16, background: COLORS.border, margin: "0 4px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600 }}>リンク先:</span>
              <select
                value={mixedLinks ? "mixed" : commonLink}
                onChange={handleLinkChange}
                style={{
                  ...inputStyle,
                  width: 140,
                  fontSize: 12,
                  padding: "4px 8px",
                  background: mixedLinks ? "#f9fafb" : "#fff",
                  cursor: "pointer"
                }}
              >
                {mixedLinks && <option value="mixed" disabled>複数混在...</option>}
                <option value="">(なし)</option>
                {pages.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />
        {/* JSON export */}
        <div style={{ width: 1, height: 24, background: COLORS.border, margin: "0 12px" }} />

        {/* Zoom */}
        <button onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))} style={iconBtn}>−</button>
        <span style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: "monospace", minWidth: 40, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))} style={iconBtn}>＋</button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...iconBtn, fontSize: 9 }}>
          リセット
        </button>

        <div style={{ width: 1, height: 24, background: COLORS.border, margin: "0 12px" }} />

        <button onClick={() => setIsAutoReflow(!isAutoReflow)} style={{ ...btnSecondary, marginRight: 8, background: isAutoReflow ? COLORS.accentSoft : 'transparent', borderColor: isAutoReflow ? COLORS.accent : COLORS.border, color: isAutoReflow ? COLORS.accent : COLORS.textMuted }}>
          自動リフロー
        </button>
        <button onClick={() => setIsA4Mode(!isA4Mode)} style={{ ...btnSecondary, marginRight: 8, background: isA4Mode ? COLORS.accentSoft : 'transparent', borderColor: isA4Mode ? COLORS.accent : COLORS.border, color: isA4Mode ? COLORS.accent : COLORS.textMuted }}>
          A4モード
        </button>
        <button onClick={exportToExcel} style={{ ...btnSecondary, marginRight: 8, borderColor: "#10b981", color: "#10b981" }}>
          Excel出力
        </button>
        <button onClick={saveGcs} style={{ ...btnSecondary, marginRight: 4, borderColor: "#6366f1", color: "#6366f1" }}>
          💾 GCS保存
        </button>
        <button onClick={loadGcs} style={{ ...btnSecondary, marginRight: 8, borderColor: "#f59e0b", color: "#f59e0b" }}>
          📂 GCS読込
        </button>
        <button onClick={exportCanvasDir} style={{ ...btnSecondary, marginRight: 4, borderColor: "#9ca3af", color: "#4b5563" }}>
          Obsidian用出力 (JSON Canvas)
        </button>
        <button onClick={importCanvasDir} style={{ ...btnSecondary, marginRight: 4, borderColor: "#9ca3af", color: "#4b5563" }}>
          Obsidian用読込 (JSON Canvas)
        </button>
        <button onClick={() => setShowJson(true)} style={btnPrimary}>
          状態デバッグ
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          cursor: isPanning ? "grabbing" : "default",
        }}
        onMouseDown={(e) => {
          handleCanvasClick();
          handleCanvasMouseDown(e);
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            width: effectiveWidth,
            height: effectiveHeight,
            background: isA4Mode ? "#fff" : "transparent",
            boxShadow: isA4Mode ? "0 4px 20px rgba(0,0,0,0.1)" : "none",
            border: isA4Mode ? `1px solid ${COLORS.border}` : "none",
            margin: isA4Mode ? "40px" : 0,
            overflow: "hidden",
            transition: "width 0.3s, height 0.3s, background 0.3s",
          }}
        >
          {/* Grid */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <defs>
              <pattern id="minor" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                  fill="none"
                  stroke={COLORS.grid}
                  strokeWidth="0.5"
                />
              </pattern>
              <pattern id="major" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
                <rect width={GRID_SIZE * 5} height={GRID_SIZE * 5} fill="url(#minor)" />
                <path
                  d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`}
                  fill="none"
                  stroke={COLORS.gridMajor}
                  strokeWidth="0.8"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#major)" />
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <CanvasNode
              key={node.id}
              node={{ ...node, onNavigate: (pageId) => { setActivePageId(pageId); setSelectedIds([]); } }}
              selected={selectedIds.includes(node.id)}
              onSelect={handleSelect}
              onDragStart={handleDragStart}
              onResizeStart={handleResizeStart}
              onDoubleClick={handleDoubleClick}
            />
          ))}
        </div>
      </div>

      {/* ── Status / Pages Tab Bar ── */}
      <div
        style={{
          height: 36,
          background: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 4,
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {pages.map((p) => {
          const isActive = p.id === activePageId;
          return (
            <div
              key={p.id}
              onClick={() => { setActivePageId(p.id); setSelectedIds([]); }}
              onDoubleClick={() => {
                const newName = prompt("ページ名を変更:", p.name) || p.name;
                renamePage(p.id, newName);
              }}
              style={{
                padding: "6px 16px",
                background: isActive ? COLORS.accentSoft : "transparent",
                color: isActive ? COLORS.accent : COLORS.textMuted,
                borderRadius: "6px 6px 0 0",
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                borderBottom: isActive ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                transition: "all 0.15s",
                userSelect: "none"
              }}
            >
              {p.name}
            </div>
          );
        })}
        <button
          onClick={addPage}
          style={{
            ...iconBtn,
            marginLeft: 8,
            width: 24, height: 24,
            background: "trannsparent",
            color: COLORS.textMuted,
          }}
          title="新規ページ追加"
        >
          ＋
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: COLORS.textDim, fontSize: 10, fontFamily: "monospace", paddingRight: 16 }}>
          ノード数: {nodes.length} | 選択: {selectedIds.length}
        </span>
      </div>

      {/* ── Modals ── */}
      {
        editingNode && (editingNode.type === "text" || editingNode.type === "table") && (
          <TextEditorModal
            node={editingNode}
            onSave={handleSaveEdit}
            onClose={() => setEditingNode(null)}
          />
        )
      }
      {
        editingNode && editingNode.type === "file" && (
          <DrawioModal
            node={editingNode}
            onSave={handleSaveEdit}
            onClose={() => setEditingNode(null)}
          />
        )
      }
      {
        aiAssistNode && (
          <AiChatModal
            node={aiAssistNode}
            onApply={(updatedNode) => {
              setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
              setAiAssistNode(null);
            }}
            onClose={() => setAiAssistNode(null)}
          />
        )
      }
      {showTemplateModal && (
        <TemplateModal
          onSelect={instantiateTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
      {showJson && <JsonPanel nodes={nodes} onClose={() => setShowJson(false)} />}
    </div >
  );
}

// ── Helper Components ────────────────────────────────────────────────────────
function ToolButton({ onClick, title, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        background: hover ? COLORS.surfaceHover : "transparent",
        border: `1px solid ${hover ? COLORS.border : "transparent"}`,
        borderRadius: 6,
        color: hover ? COLORS.text : COLORS.textMuted,
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 12,
        cursor: "pointer",
        transition: "all 0.1s",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

const iconBtn = {
  width: 26,
  height: 26,
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  color: COLORS.textMuted,
  cursor: "pointer",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "monospace",
};
