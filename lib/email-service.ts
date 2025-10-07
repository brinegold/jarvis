import nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

interface TransactionEmailData {
  userEmail: string
  userName: string
  transactionType: 'deposit' | 'withdrawal' | 'transfer' | 'staking' | 'jrc_purchase'
  status: 'success' | 'failed' | 'pending'
  amount: number
  currency: string
  transactionId?: string
  txHash?: string
  fromAddress?: string
  toAddress?: string
  fee?: number
  netAmount?: number
  stakingPeriod?: number
  dailyPercentage?: number
  errorMessage?: string
}

class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    const emailConfig: EmailConfig = {
      host: process.env.SMTP_HOST || 'server303.web-hosting.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'admin@jarvisstaking.live',
        pass: process.env.SMTP_PASS || ';,sb5@1BcUBZ'
      }
    }

    this.transporter = nodemailer.createTransport(emailConfig)
  }

  private getEmailTemplate(data: TransactionEmailData): { subject: string; html: string } {
    const { transactionType, status, amount, currency, userName } = data
    
    const statusColor = status === 'success' ? '#10B981' : status === 'failed' ? '#EF4444' : '#F59E0B'
    const statusText = status === 'success' ? 'Successful' : status === 'failed' ? 'Failed' : 'Pending'
    
    const baseTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Jarvis Staking - Transaction Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
          .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; margin: 10px 0; }
          .transaction-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #666; }
          .detail-value { color: #333; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .error { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Jarvis Staking Platform</h1>
            <h2>${this.getTransactionTitle(transactionType)} Notification</h2>
          </div>
          
          <p>Hello <strong>${userName}</strong>,</p>
          
          <div class="status-badge" style="background-color: ${statusColor};">
            ${statusText.toUpperCase()}
          </div>
          
          ${this.getTransactionContent(data)}
          
          <div class="transaction-details">
            <h3>📋 Transaction Details</h3>
            ${this.getTransactionDetailsHTML(data)}
          </div>
          
          ${this.getAdditionalContent(data)}
          
          <div class="footer">
            <p>Thank you for using Jarvis Staking Platform!</p>
            <p>If you have any questions, please contact our support team.</p>
            <p><small>This is an automated message. Please do not reply to this email.</small></p>
          </div>
        </div>
      </body>
      </html>
    `

    return {
      subject: `Jarvis Staking - ${this.getTransactionTitle(transactionType)} ${statusText}`,
      html: baseTemplate
    }
  }

  private getTransactionTitle(type: string): string {
    switch (type) {
      case 'deposit': return 'Deposit'
      case 'withdrawal': return 'Withdrawal'
      case 'transfer': return 'Transfer'
      case 'staking': return 'Staking'
      case 'jrc_purchase': return 'JRC Purchase'
      default: return 'Transaction'
    }
  }

  private getTransactionContent(data: TransactionEmailData): string {
    const { transactionType, status, amount, currency } = data

    if (status === 'success') {
      switch (transactionType) {
        case 'deposit':
          return `
            <div class="success">
              <p>✅ Your deposit of <strong>${amount} ${currency}</strong> has been successfully processed and added to your account.</p>
            </div>
          `
        case 'withdrawal':
          return `
            <div class="success">
              <p>✅ Your withdrawal request of <strong>${amount} ${currency}</strong> has been successfully processed.</p>
            </div>
          `
        case 'transfer':
          return `
            <div class="success">
              <p>✅ Your transfer of <strong>${amount} ${currency}</strong> has been completed successfully.</p>
            </div>
          `
        case 'staking':
          return `
            <div class="success">
              <p>✅ Your JRC staking of <strong>${amount} ${currency}</strong> has been activated successfully.</p>
            </div>
          `
        case 'jrc_purchase':
          return `
            <div class="success">
              <p>✅ Your JRC token purchase of <strong>${amount} ${currency}</strong> has been completed successfully.</p>
            </div>
          `
      }
    } else if (status === 'failed') {
      return `
        <div class="error">
          <p>❌ Your ${transactionType} request of <strong>${amount} ${currency}</strong> has failed.</p>
          ${data.errorMessage ? `<p><strong>Reason:</strong> ${data.errorMessage}</p>` : ''}
          <p>Please try again or contact support if the issue persists.</p>
        </div>
      `
    } else {
      return `
        <div class="warning">
          <p>⏳ Your ${transactionType} request of <strong>${amount} ${currency}</strong> is currently being processed.</p>
          <p>We will notify you once the transaction is completed.</p>
        </div>
      `
    }

    return ''
  }

  private getTransactionDetailsHTML(data: TransactionEmailData): string {
    let details = `
      <div class="detail-row">
        <span class="detail-label">Transaction Type:</span>
        <span class="detail-value">${this.getTransactionTitle(data.transactionType)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount:</span>
        <span class="detail-value">${data.amount} ${data.currency}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${new Date().toLocaleString()}</span>
      </div>
    `

    if (data.transactionId) {
      details += `
        <div class="detail-row">
          <span class="detail-label">Transaction ID:</span>
          <span class="detail-value">${data.transactionId}</span>
        </div>
      `
    }

    if (data.txHash) {
      details += `
        <div class="detail-row">
          <span class="detail-label">Transaction Hash:</span>
          <span class="detail-value" style="word-break: break-all;">${data.txHash}</span>
        </div>
      `
    }

    if (data.fee !== undefined) {
      details += `
        <div class="detail-row">
          <span class="detail-label">Fee:</span>
          <span class="detail-value">${data.fee} ${data.currency}</span>
        </div>
      `
    }

    if (data.netAmount !== undefined) {
      details += `
        <div class="detail-row">
          <span class="detail-label">Net Amount:</span>
          <span class="detail-value">${data.netAmount} ${data.currency}</span>
        </div>
      `
    }

    if (data.fromAddress) {
      details += `
        <div class="detail-row">
          <span class="detail-label">From Address:</span>
          <span class="detail-value" style="word-break: break-all;">${data.fromAddress}</span>
        </div>
      `
    }

    if (data.toAddress) {
      details += `
        <div class="detail-row">
          <span class="detail-label">To Address:</span>
          <span class="detail-value" style="word-break: break-all;">${data.toAddress}</span>
        </div>
      `
    }

    if (data.stakingPeriod) {
      details += `
        <div class="detail-row">
          <span class="detail-label">Staking Period:</span>
          <span class="detail-value">${data.stakingPeriod} days</span>
        </div>
      `
    }

    if (data.dailyPercentage) {
      details += `
        <div class="detail-row">
          <span class="detail-label">Daily Percentage:</span>
          <span class="detail-value">${data.dailyPercentage}%</span>
        </div>
      `
    }

    return details
  }

  private getAdditionalContent(data: TransactionEmailData): string {
    if (data.transactionType === 'staking' && data.status === 'success') {
      return `
        <div class="success">
          <h3>🎯 Staking Information</h3>
          <p>Your JRC tokens are now earning daily rewards!</p>
          <ul>
            <li>Daily reward rate: <strong>${data.dailyPercentage}%</strong></li>
            <li>Staking period: <strong>${data.stakingPeriod} days</strong></li>
            <li>Expected total return: <strong>${((data.dailyPercentage || 0) * (data.stakingPeriod || 0)).toFixed(2)}%</strong></li>
          </ul>
          <p>Rewards will be distributed daily to your account automatically.</p>
        </div>
      `
    }

    if (data.transactionType === 'withdrawal' && data.status === 'success') {
      return `
        <div class="success">
          <h3>💰 Withdrawal Information</h3>
          <p>Your withdrawal has been processed and sent to your specified wallet address.</p>
          <p>Please allow some time for the transaction to be confirmed on the blockchain.</p>
        </div>
      `
    }

    return ''
  }

  async sendTransactionEmail(data: TransactionEmailData): Promise<boolean> {
    try {
      const { subject, html } = this.getEmailTemplate(data)

      const mailOptions = {
        from: `"Jarvis Staking Platform" <${process.env.SMTP_USER}>`,
        to: data.userEmail,
        subject,
        html
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log('Email sent successfully:', result.messageId)
      return true
    } catch (error) {
      console.error('Error sending email:', error)
      return false
    }
  }

  async sendDepositNotification(userEmail: string, userName: string, amount: number, currency: string, status: 'success' | 'failed', txHash?: string, fee?: number, netAmount?: number, errorMessage?: string): Promise<boolean> {
    return this.sendTransactionEmail({
      userEmail,
      userName,
      transactionType: 'deposit',
      status,
      amount,
      currency,
      txHash,
      fee,
      netAmount,
      errorMessage
    })
  }

  async sendWithdrawalNotification(userEmail: string, userName: string, amount: number, currency: string, status: 'success' | 'failed' | 'pending', toAddress?: string, txHash?: string, errorMessage?: string): Promise<boolean> {
    return this.sendTransactionEmail({
      userEmail,
      userName,
      transactionType: 'withdrawal',
      status,
      amount,
      currency,
      toAddress,
      txHash,
      errorMessage
    })
  }

  async sendTransferNotification(userEmail: string, userName: string, amount: number, currency: string, status: 'success' | 'failed', fromAddress?: string, toAddress?: string, errorMessage?: string): Promise<boolean> {
    return this.sendTransactionEmail({
      userEmail,
      userName,
      transactionType: 'transfer',
      status,
      amount,
      currency,
      fromAddress,
      toAddress,
      errorMessage
    })
  }

  async sendStakingNotification(userEmail: string, userName: string, amount: number, currency: string, status: 'success' | 'failed', stakingPeriod?: number, dailyPercentage?: number, errorMessage?: string): Promise<boolean> {
    return this.sendTransactionEmail({
      userEmail,
      userName,
      transactionType: 'staking',
      status,
      amount,
      currency,
      stakingPeriod,
      dailyPercentage,
      errorMessage
    })
  }

  async sendJrcPurchaseNotification(userEmail: string, userName: string, amount: number, currency: string, status: 'success' | 'failed', transactionId?: string, errorMessage?: string): Promise<boolean> {
    return this.sendTransactionEmail({
      userEmail,
      userName,
      transactionType: 'jrc_purchase',
      status,
      amount,
      currency,
      transactionId,
      errorMessage
    })
  }
}

export default EmailService
