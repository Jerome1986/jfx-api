// 文件说明：员工业绩概览返回数据，金额单位为元。
export interface EmployeePerformanceSummary {
  month: string
  signedCustomerCount: number
  signedAmount: string
  completedProjectCount: number
  companyRank: number | null
}
