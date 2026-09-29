// 后台员工业绩表，金额单位为元。
export interface AdminEmployeePerformanceRow {
  employeeId: number
  employeeNo: string
  name: string
  mobile: string
  department: string | null
  position: string | null
  status: boolean
  isActive: boolean
  signedCustomerCount: number
  signedAmount: string
  completedProjectCount: number
  averageSignedAmount: string
  companyRank: number | null
}

export interface AdminEmployeePerformanceResult {
  month: string
  list: AdminEmployeePerformanceRow[]
  total: number
  pageNum: number
  pageSize: number
  totalPage: number
}
