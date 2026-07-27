export type LeadsGetManyInput = undefined

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  jobTitle: string | null
  companyName: string | null
  yearsAtCompany: number | null
  countryCode: string | null
  message: string | null
  emailVerified: boolean | null
}[]
