export interface LeadsBulkImportInput {
  leads: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    linkedinUrl?: string
    jobTitle?: string
    companyName?: string
    yearsAtCompany?: number
    countryCode?: string
  }[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  errors: Array<{
    lead: any
    error: string
  }>
}
