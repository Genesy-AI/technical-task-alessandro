import { FC, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../api'
import {
  LEAD_FIELD_GROUPS,
  LeadFieldGroup,
  LeadFieldValues,
  previewTemplate,
  searchLeadFields,
} from '../utils/leadFields'

interface MessageTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  selectedLeadIds: number[]
  selectedLeadsCount: number
  /** The lead the live preview is rendered against. Usually the first one selected. */
  previewLead?: LeadFieldValues
}

const allGroupsExpanded = () =>
  Object.fromEntries(LEAD_FIELD_GROUPS.map((group) => [group, true])) as Record<LeadFieldGroup, boolean>

export const MessageTemplateModal: FC<MessageTemplateModalProps> = ({
  isOpen,
  onClose,
  selectedLeadIds,
  selectedLeadsCount,
  previewLead,
}) => {
  const [template, setTemplate] = useState('')
  const [fieldQuery, setFieldQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState(allGroupsExpanded)
  const [generationResult, setGenerationResult] = useState<{
    success: boolean
    generatedCount: number
    errors: Array<{ leadId: number; leadName: string; error: string }>
  } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  const generateMessagesMutation = useMutation({
    mutationFn: async (data: { leadIds: number[]; template: string }) => api.leads.generateMessages(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'getMany'] })
      setGenerationResult(result)

      if (result.errors.length === 0) {
        const message =
          result.generatedCount === 1
            ? `Successfully generated message for ${result.generatedCount} lead`
            : `Successfully generated messages for ${result.generatedCount} leads`
        toast.success(message)
        onClose()
        setTemplate('')
        setFieldQuery('')
        setGenerationResult(null)
      } else {
        const successMessage =
          result.generatedCount === 1
            ? `Generated message for ${result.generatedCount} lead`
            : `Generated messages for ${result.generatedCount} leads`
        const errorMessage =
          result.errors.length === 1
            ? `${result.errors.length} lead had errors`
            : `${result.errors.length} leads had errors`
        toast.success(`${successMessage}, but ${errorMessage}. Check details below.`)
      }
    },
    onError: () => {
      toast.error('Failed to generate messages. Please try again.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (template.trim() && selectedLeadIds.length > 0) {
      setGenerationResult(null)

      generateMessagesMutation.mutate({
        leadIds: selectedLeadIds,
        template: template.trim(),
      })
    }
  }

  const handleClose = useCallback(() => {
    if (!generateMessagesMutation.isPending) {
      onClose()
      setTemplate('')
      setFieldQuery('')
      setGenerationResult(null)
    }
  }, [generateMessagesMutation.isPending, onClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'hidden'

      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleClose])

  const isSearching = fieldQuery.trim().length > 0
  const matchingFields = useMemo(() => searchLeadFields(fieldQuery), [fieldQuery])
  const visibleGroups = LEAD_FIELD_GROUPS.filter((group) =>
    matchingFields.some((field) => field.group === group)
  )
  // While searching, every group with a hit opens: hiding a match behind a collapsed heading would
  // make the search look broken. Manual expansion state is preserved for when the query is cleared.
  const isGroupExpanded = (group: LeadFieldGroup) => isSearching || expandedGroups[group]

  const toggleGroup = (group: LeadFieldGroup) =>
    setExpandedGroups((groups) => ({ ...groups, [group]: !groups[group] }))

  const preview = useMemo(() => previewTemplate(template, previewLead), [template, previewLead])
  const previewLeadName = [previewLead?.firstName, previewLead?.lastName].filter(Boolean).join(' ')

  const insertField = (field: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newTemplate = template.substring(0, start) + `{${field}}` + template.substring(end)
      setTemplate(newTemplate)

      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + field.length + 2, start + field.length + 2)
      }, 0)
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Generate Messages for {selectedLeadsCount} Lead{selectedLeadsCount !== 1 ? 's' : ''}
            </h2>
            <button
              onClick={handleClose}
              disabled={generateMessagesMutation.isPending}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="message-template" className="block text-sm font-medium text-gray-700 mb-2">
                Message Template
              </label>
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-md">
                  <div className="flex items-center gap-2 p-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600 whitespace-nowrap">Insert field:</span>
                    <input
                      type="search"
                      value={fieldQuery}
                      onChange={(e) => setFieldQuery(e.target.value)}
                      placeholder="Search fields..."
                      aria-label="Search fields"
                      className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-2 space-y-2">
                    {visibleGroups.map((group) => (
                      <div key={group}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(group)}
                          aria-expanded={isGroupExpanded(group)}
                          aria-controls={`field-group-${group}`}
                          className="flex items-center gap-1 w-full text-left text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                        >
                          <span aria-hidden="true">{isGroupExpanded(group) ? '▾' : '▸'}</span>
                          {group}
                        </button>
                        {isGroupExpanded(group) && (
                          <div id={`field-group-${group}`} className="flex flex-wrap gap-2 mt-1">
                            {matchingFields
                              .filter((field) => field.group === group)
                              .map((field) => (
                                <button
                                  key={field.key}
                                  type="button"
                                  title={field.label}
                                  onClick={() => insertField(field.key)}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                                >
                                  {`{${field.key}}`}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {visibleGroups.length === 0 && (
                      <p className="text-sm text-gray-500">No fields match "{fieldQuery.trim()}"</p>
                    )}
                  </div>
                </div>
                <textarea
                  ref={textareaRef}
                  id="message-template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  placeholder="Enter your message template here. Use {fieldName} to insert dynamic values.&#10;&#10;Example: Hi {firstName}, I noticed you have spent {yearsAtCompany} years at {companyName} as a {jobTitle}. Would you be interested in..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  required
                />
                {template.trim() && (
                  <div className="border border-gray-200 rounded-md">
                    <div className="px-3 py-2 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preview{previewLeadName ? ` — ${previewLeadName}` : ''}
                    </div>
                    <p className="px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">{preview.text}</p>
                    {(preview.unknownFields.length > 0 || preview.missingFields.length > 0) && (
                      <div className="px-3 py-2 border-t border-gray-200 space-y-1">
                        {preview.unknownFields.length > 0 && (
                          <p className="text-sm text-red-700">
                            Not a lead field: {preview.unknownFields.map((field) => `{${field}}`).join(', ')}.
                            No messages will be generated until this is fixed.
                          </p>
                        )}
                        {preview.missingFields.length > 0 && (
                          <p className="text-sm text-amber-700">
                            Shown with example values because this lead has no{' '}
                            {preview.missingFields.join(', ')}. Leads missing these fields will be skipped.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Use curly braces around field names (e.g., {`{firstName}`}) to insert dynamic values. If a
                field is missing for a lead, an error will be shown and no message will be generated for that
                lead.
              </p>
            </div>

            {generationResult && (
              <div className="space-y-4">
                {generationResult.generatedCount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-green-600 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-green-800">
                        Successfully generated messages for {generationResult.generatedCount} lead
                        {generationResult.generatedCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {generationResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-red-800 mb-2">
                          Failed to generate messages for {generationResult.errors.length} lead
                          {generationResult.errors.length !== 1 ? 's' : ''}:
                        </h4>
                        <div className="space-y-1">
                          {generationResult.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                              <span className="font-medium">{error.leadName}</span>: {error.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={generateMessagesMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generationResult ? 'Close' : 'Cancel'}
              </button>
              {(!generationResult || generationResult.errors.length > 0) && (
                <button
                  type="submit"
                  disabled={!template.trim() || generateMessagesMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generateMessagesMutation.isPending ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Generating...
                    </>
                  ) : generationResult ? (
                    'Try Again'
                  ) : (
                    'Generate Messages'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
