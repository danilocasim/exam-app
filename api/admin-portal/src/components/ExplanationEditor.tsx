/**
 * ExplanationEditor — Admin portal component for authoring rich explanations.
 *
 * Features:
 * - Plain text textarea (legacy explanation field, always editable)
 * - Optional "Rich Content" mode with block-based editing
 * - Insert Link (label + URL) → creates a link block
 * - Insert Image (upload or URL) → creates an image block with preview
 * - Preview panel showing rendered blocks
 */
import { useState, useRef, useCallback } from 'react';
import type { ExplanationBlock } from '../services/api';
import { api } from '../services/api';
import { colors, radius } from '../theme';

interface Props {
  explanation: string;
  explanationBlocks?: ExplanationBlock[] | null;
  onExplanationChange: (text: string) => void;
  onBlocksChange: (blocks: ExplanationBlock[] | null) => void;
  inputStyle: React.CSSProperties;
}

export function ExplanationEditor({
  explanation,
  explanationBlocks,
  onExplanationChange,
  onBlocksChange,
  inputStyle,
}: Props) {
  const [showRichEditor, setShowRichEditor] = useState(
    !!(explanationBlocks && explanationBlocks.length > 0),
  );
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showImageForm, setShowImageForm] = useState(false);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blocks = explanationBlocks || [];

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: colors.muted,
    flex: 1,
  };

  const addBlock = useCallback(
    (block: ExplanationBlock) => {
      onBlocksChange([...blocks, block]);
    },
    [blocks, onBlocksChange],
  );

  /**
   * Extract S3 filename from a URL if it belongs to our explanations bucket.
   * Returns null if the URL is not an S3 explanation image.
   */
  const extractS3Filename = useCallback((url: string): string | null => {
    // Match URLs like: https://{bucket}.s3.{region}.amazonaws.com/explanations/{filename}
    const match = url.match(
      /^https:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com\/explanations\/(.+)$/,
    );
    return match ? match[1] : null;
  }, []);

  const removeBlock = useCallback(
    (index: number) => {
      const block = blocks[index];

      // If removing an S3-hosted image block, delete from S3 (best-effort)
      if (block?.type === 'image' && typeof block.content === 'string') {
        const filename = extractS3Filename(block.content);
        if (filename) {
          api.deleteExplanationImage(filename).catch((err) => {
            console.error('Failed to delete S3 image:', err);
            setDeleteError(
              `Failed to delete image from storage: ${err instanceof Error ? err.message : String(err)}. Check API server logs and ensure the AWS IAM user has s3:DeleteObject permission.`,
            );
          });
        }
      }

      const newBlocks = blocks.filter((_, i) => i !== index);
      onBlocksChange(newBlocks.length > 0 ? newBlocks : null);
    },
    [blocks, onBlocksChange, extractS3Filename],
  );

  const handleInsertLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    try {
      const parsed = new URL(linkUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return;
      }
    } catch {
      return;
    }
    addBlock({
      type: 'link',
      content: linkUrl.trim(),
      meta: linkLabel.trim() ? { label: linkLabel.trim() } : undefined,
    });
    setLinkLabel('');
    setLinkUrl('');
    setShowLinkForm(false);
  }, [linkUrl, linkLabel, addBlock]);

  const handleInsertImageUrl = useCallback(() => {
    if (!imageUrl.trim()) return;
    try {
      const parsed = new URL(imageUrl.trim());
      if (parsed.protocol !== 'https:') {
        setUploadError('Image URL must use HTTPS');
        return;
      }
    } catch {
      setUploadError('Invalid URL');
      return;
    }
    addBlock({
      type: 'image',
      content: imageUrl.trim(),
      meta: {
        ...(imageAlt.trim() ? { alt: imageAlt.trim() } : {}),
        ...(imageCaption.trim() ? { caption: imageCaption.trim() } : {}),
      },
    });
    setImageUrl('');
    setImageAlt('');
    setImageCaption('');
    setUploadError('');
    setShowImageForm(false);
  }, [imageUrl, imageAlt, imageCaption, addBlock]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate type
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        setUploadError('Only PNG, JPG, and WebP are allowed');
        return;
      }
      // Validate size
      if (file.size > 2 * 1024 * 1024) {
        setUploadError('File must be under 2MB');
        return;
      }

      setUploading(true);
      setUploadError('');
      try {
        const result = await api.uploadExplanationImage(file);
        addBlock({
          type: 'image',
          content: result.url,
          meta: {
            ...(imageAlt.trim() ? { alt: imageAlt.trim() } : {}),
            ...(imageCaption.trim() ? { caption: imageCaption.trim() } : {}),
          },
        });
        setImageAlt('');
        setImageCaption('');
        setShowImageForm(false);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [imageAlt, imageCaption, addBlock],
  );

  const handleAddParagraph = useCallback(() => {
    addBlock({ type: 'paragraph', content: '' });
  }, [addBlock]);

  const handleAddBulletList = useCallback(() => {
    addBlock({
      type: 'bullet_list',
      content: '',
      meta: { listItems: [''] },
    });
  }, [addBlock]);

  const handleAddSeparator = useCallback(() => {
    addBlock({ type: 'separator', content: '' });
  }, [addBlock]);

  const updateBlockContent = useCallback(
    (index: number, content: string) => {
      const newBlocks = [...blocks];
      newBlocks[index] = { ...newBlocks[index], content };
      onBlocksChange(newBlocks);
    },
    [blocks, onBlocksChange],
  );

  const updateListItem = useCallback(
    (blockIndex: number, itemIndex: number, value: string) => {
      const newBlocks = [...blocks];
      const items = [...(newBlocks[blockIndex].meta?.listItems || [])];
      items[itemIndex] = value;
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        meta: { ...newBlocks[blockIndex].meta, listItems: items },
      };
      onBlocksChange(newBlocks);
    },
    [blocks, onBlocksChange],
  );

  const addListItem = useCallback(
    (blockIndex: number) => {
      const newBlocks = [...blocks];
      const items = [...(newBlocks[blockIndex].meta?.listItems || []), ''];
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        meta: { ...newBlocks[blockIndex].meta, listItems: items },
      };
      onBlocksChange(newBlocks);
    },
    [blocks, onBlocksChange],
  );

  const removeListItem = useCallback(
    (blockIndex: number, itemIndex: number) => {
      const newBlocks = [...blocks];
      const items = (newBlocks[blockIndex].meta?.listItems || []).filter(
        (_, i) => i !== itemIndex,
      );
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        meta: { ...newBlocks[blockIndex].meta, listItems: items },
      };
      onBlocksChange(newBlocks);
    },
    [blocks, onBlocksChange],
  );

  const smallBtnStyle: React.CSSProperties = {
    background: 'none',
    border: `1px solid ${colors.border}`,
    color: colors.primary,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: radius.sm,
  };

  const iconBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: colors.error,
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 6px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Legacy explanation textarea */}
      <label style={labelStyle}>
        Explanation
        <textarea
          value={explanation}
          onChange={(e) => onExplanationChange(e.target.value)}
          style={{
            ...inputStyle,
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: 100,
          }}
          required
          minLength={50}
        />
        <span
          style={{
            fontSize: 11,
            color: colors.subtle,
            alignSelf: 'flex-end',
          }}
        >
          {explanation.length} chars
        </span>
      </label>

      {/* Toggle rich content mode */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setShowRichEditor(!showRichEditor);
            if (!showRichEditor && blocks.length === 0) {
              // Auto-create first paragraph block from explanation text
              onBlocksChange([{ type: 'paragraph', content: explanation }]);
            }
          }}
          style={{
            ...smallBtnStyle,
            color: showRichEditor ? colors.error : colors.primary,
            borderColor: showRichEditor ? colors.error : colors.border,
          }}
        >
          {showRichEditor
            ? '✕ Close Rich Editor'
            : '✦ Add Rich Content (images, links, blocks)'}
        </button>
      </div>

      {/* Rich content editor */}
      {showRichEditor && (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: 16,
            background: colors.surface,
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 14,
              paddingBottom: 12,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <button
              type="button"
              onClick={handleAddParagraph}
              style={smallBtnStyle}
            >
              + Paragraph
            </button>
            <button
              type="button"
              onClick={() => setShowLinkForm(true)}
              style={smallBtnStyle}
            >
              + Link
            </button>
            <button
              type="button"
              onClick={() => setShowImageForm(true)}
              style={smallBtnStyle}
            >
              + Image
            </button>
            <button
              type="button"
              onClick={handleAddBulletList}
              style={smallBtnStyle}
            >
              + Bullet List
            </button>
            <button
              type="button"
              onClick={handleAddSeparator}
              style={smallBtnStyle}
            >
              + Separator
            </button>
          </div>

          {/* Insert Link Form */}
          {showLinkForm && (
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.sm,
                padding: 12,
                marginBottom: 12,
                background: colors.surfaceRaised,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.muted,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Insert Link
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  style={{ ...inputStyle, flex: 2 }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleInsertLink}
                  disabled={!linkUrl.trim()}
                  style={{
                    ...smallBtnStyle,
                    background: colors.primary,
                    color: '#1A1A2E',
                    border: 'none',
                    fontWeight: 700,
                    opacity: linkUrl.trim() ? 1 : 0.5,
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowLinkForm(false)}
                  style={smallBtnStyle}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Insert Image Form */}
          {showImageForm && (
            <div
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.sm,
                padding: 12,
                marginBottom: 12,
                background: colors.surfaceRaised,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.muted,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Insert Image
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Alt text (optional)"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="text"
                  placeholder="Caption (optional)"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <input
                  type="url"
                  placeholder="https://... image URL"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={{ ...inputStyle, flex: 2 }}
                />
                <button
                  type="button"
                  onClick={handleInsertImageUrl}
                  disabled={!imageUrl.trim()}
                  style={{
                    ...smallBtnStyle,
                    background: colors.primary,
                    color: '#1A1A2E',
                    border: 'none',
                    fontWeight: 700,
                    opacity: imageUrl.trim() ? 1 : 0.5,
                  }}
                >
                  Add URL
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 12, color: colors.subtle }}>or</span>
                <label
                  style={{
                    ...smallBtnStyle,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: uploading ? 'wait' : 'pointer',
                    opacity: uploading ? 0.5 : 1,
                  }}
                >
                  {uploading ? 'Uploading...' : '📁 Upload File'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                </label>
                <span style={{ fontSize: 11, color: colors.subtle }}>
                  PNG/JPG/WebP, max 2MB
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowImageForm(false);
                    setUploadError('');
                  }}
                  style={smallBtnStyle}
                >
                  Cancel
                </button>
              </div>
              {uploadError && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: colors.error,
                  }}
                >
                  {uploadError}
                </div>
              )}
            </div>
          )}

          {/* S3 delete error */}
          {deleteError && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: `1px solid ${colors.error}`,
                borderRadius: radius.sm,
                fontSize: 12,
                color: colors.error,
              }}
            >
              ⚠ {deleteError}
              <button
                type="button"
                onClick={() => setDeleteError('')}
                style={{
                  marginLeft: 10,
                  background: 'none',
                  border: 'none',
                  color: colors.error,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Block list */}
          {blocks.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 20,
                color: colors.subtle,
                fontSize: 13,
              }}
            >
              No blocks yet. Use the toolbar above to add content.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {blocks.map((block, index) => (
                <div
                  key={index}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.sm,
                    padding: 10,
                    background: colors.surfaceRaised,
                    position: 'relative',
                  }}
                >
                  {/* Block type badge + remove button */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: colors.primary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        background: 'rgba(255,153,0,0.1)',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {block.type.replace('_', ' ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBlock(index)}
                      style={iconBtnStyle}
                      title="Remove block"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Block content editor */}
                  {block.type === 'paragraph' && (
                    <textarea
                      value={block.content}
                      onChange={(e) =>
                        updateBlockContent(index, e.target.value)
                      }
                      style={{
                        ...inputStyle,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        minHeight: 60,
                        width: '100%',
                      }}
                      placeholder="Paragraph text..."
                    />
                  )}

                  {block.type === 'link' && (
                    <div style={{ fontSize: 13, color: colors.body }}>
                      <span style={{ color: colors.primary }}>
                        {block.meta?.label || block.content}
                      </span>
                      {block.meta?.label && (
                        <span
                          style={{
                            color: colors.subtle,
                            marginLeft: 8,
                            fontSize: 11,
                          }}
                        >
                          → {block.content}
                        </span>
                      )}
                    </div>
                  )}

                  {block.type === 'image' && (
                    <div>
                      <img
                        src={block.content}
                        alt={block.meta?.alt || 'Preview'}
                        style={{
                          maxWidth: '100%',
                          maxHeight: 200,
                          borderRadius: 6,
                          objectFit: 'contain',
                          background: '#111827',
                        }}
                      />
                      {block.meta?.caption && (
                        <div
                          style={{
                            fontSize: 11,
                            color: colors.subtle,
                            fontStyle: 'italic',
                            marginTop: 4,
                          }}
                        >
                          {block.meta.caption}
                        </div>
                      )}
                    </div>
                  )}

                  {block.type === 'bullet_list' && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {(block.meta?.listItems || []).map((item, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span style={{ color: colors.primary }}>•</span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) =>
                              updateListItem(index, i, e.target.value)
                            }
                            style={{ ...inputStyle, flex: 1 }}
                            placeholder="List item..."
                          />
                          {(block.meta?.listItems?.length || 0) > 1 && (
                            <button
                              type="button"
                              onClick={() => removeListItem(index, i)}
                              style={iconBtnStyle}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addListItem(index)}
                        style={{
                          ...smallBtnStyle,
                          fontSize: 11,
                          alignSelf: 'flex-start',
                        }}
                      >
                        + Item
                      </button>
                    </div>
                  )}

                  {block.type === 'code' && (
                    <textarea
                      value={block.content}
                      onChange={(e) =>
                        updateBlockContent(index, e.target.value)
                      }
                      style={{
                        ...inputStyle,
                        fontFamily: 'monospace',
                        resize: 'vertical',
                        minHeight: 60,
                        width: '100%',
                        background: '#111827',
                      }}
                      placeholder="Code..."
                    />
                  )}

                  {block.type === 'separator' && (
                    <hr
                      style={{
                        border: 'none',
                        borderTop: `1px solid ${colors.border}`,
                        margin: '4px 0',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
