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

interface WelcomeEmailData {
  userEmail: string
  userName: string
  referralCode?: string
}
class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    const emailConfig: EmailConfig = {
      host: process.env.SMTP_HOST || 'mail.jarvisstaking.live',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true' || true, // Use true for port 465, false for 587
      auth: {
        user: process.env.SMTP_USER || 'admin@jarvisstaking.live',
        pass: process.env.SMTP_PASS || 'Josephnetx01@@@@'
      }
    }

    // Debug: Log the configuration (remove in production)
    console.log('SMTP Config:', {
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      user: emailConfig.auth.user,
      hasPassword: !!emailConfig.auth.pass
    })

    // Add additional options for better compatibility
    const transporterOptions = {
      ...emailConfig,
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 60000, // 60 seconds
      tls: {
        rejectUnauthorized: false // Accept self-signed certificates
      }
    }

    this.transporter = nodemailer.createTransport(transporterOptions)
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
        <title>Jarvis Staking Platform - Transaction Notification</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
          }
          .email-container {
            max-width: 650px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e1e8ed;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          }
          .email-header {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: #ffffff;
            padding: 40px 30px;
            text-align: center;
            position: relative;
          }
          .email-header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
            letter-spacing: 0.5px;
          }
          .email-header h2 {
            margin: 10px 0 0 0;
            font-size: 16px;
            font-weight: 400;
            opacity: 0.9;
            letter-spacing: 0.3px;
          }
          .email-content {
            padding: 40px 30px;
            background: #ffffff;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 30px;
            color: #2c3e50;
          }
          .status-badge {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 4px;
            color: #ffffff;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 30px;
          }
          .status-success { background-color: #27ae60; }
          .status-pending { background-color: #f39c12; }
          .status-failed { background-color: #e74c3c; }
          .transaction-summary {
            background: #f8f9fa;
            border: 1px solid #e1e8ed;
            border-radius: 6px;
            padding: 25px;
            margin: 25px 0;
          }
          .summary-title {
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 15px;
          }
          .transaction-details {
            background: #ffffff;
            border: 1px solid #e1e8ed;
            border-radius: 6px;
            margin: 30px 0;
          }
          .details-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #e1e8ed;
            border-radius: 6px 6px 0 0;
          }
          .details-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
          }
          .details-body {
            padding: 20px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #f1f3f4;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #5a6c7d;
            min-width: 140px;
          }
          .detail-value {
            color: #2c3e50;
            text-align: right;
            font-weight: 500;
          }
          .additional-info {
            background: #f8f9fa;
            border: 1px solid #e1e8ed;
            border-radius: 6px;
            padding: 25px;
            margin: 25px 0;
          }
          .additional-info h4 {
            margin-top: 0;
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
          }
          .additional-info ul {
            margin: 15px 0;
            padding-left: 20px;
          }
          .additional-info li {
            margin: 8px 0;
            color: #5a6c7d;
          }
          .email-footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e1e8ed;
            font-size: 14px;
            color: #7f8c8d;
            line-height: 1.5;
          }
          .footer-text {
            margin: 0 0 10px 0;
          }
          .footer-disclaimer {
            font-size: 12px;
            color: #95a5a6;
            font-style: italic;
          }
          @media (max-width: 768px) {
            .email-container {
              margin: 10px;
              border-radius: 4px;
            }
            .email-header {
              padding: 30px 20px;
            }
            .email-content {
              padding: 30px 20px;
            }
            .detail-row {
              flex-direction: column;
              gap: 5px;
            }
            .detail-value {
              text-align: left;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            <h1>Jarvis Staking Platform</h1>
            <h2>${this.getTransactionTitle(transactionType)} Notification</h2>
          </div>

          <div class="email-content">
            <p class="greeting">Dear ${userName},</p>

            <div class="status-badge status-${status}">
              ${statusText}
            </div>

            ${this.getTransactionContent(data)}

            <div class="transaction-details">
              <div class="details-header">
                <h3>Transaction Details</h3>
              </div>
              <div class="details-body">
                ${this.getTransactionDetailsHTML(data)}
              </div>
            </div>

            ${this.getAdditionalContent(data)}

            <div class="email-footer">
              <p class="footer-text">Thank you for choosing Jarvis Staking Platform.</p>
              <p class="footer-text">Should you require any assistance, please contact our support team.</p>
              <p class="footer-disclaimer">This is an automated message. Please do not reply to this email.</p>
            </div>
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
            <div class="transaction-summary">
              <div class="summary-title">Deposit Confirmation</div>
              <p>Your deposit of <strong>${amount} ${currency}</strong> has been successfully processed and added to your account.</p>
            </div>
          `
        case 'withdrawal':
          return `
            <div class="transaction-summary">
              <div class="summary-title">Withdrawal Confirmation</div>
              <p>Your withdrawal request of <strong>${amount} ${currency}</strong> has been successfully processed.</p>
            </div>
          `
        case 'transfer':
          return `
            <div class="transaction-summary">
              <div class="summary-title">Transfer Confirmation</div>
              <p>Your transfer of <strong>${amount} ${currency}</strong> has been completed successfully.</p>
            </div>
          `
        case 'staking':
          return `
            <div class="transaction-summary">
              <div class="summary-title">Staking Confirmation</div>
              <p>Your staking transaction of <strong>${amount} ${currency}</strong> has been activated successfully.</p>
            </div>
          `
        case 'jrc_purchase':
          return `
            <div class="transaction-summary">
              <div class="summary-title">JRC Purchase Confirmation</div>
              <p>Your JRC token purchase of <strong>${amount} ${currency}</strong> has been completed successfully.</p>
            </div>
          `
      }
    } else if (status === 'failed') {
      return `
        <div class="additional-info" style="border-left: 4px solid #e74c3c;">
          <h4>Transaction Failed</h4>
          <p>Your ${transactionType} request of <strong>${amount} ${currency}</strong> has failed.</p>
          ${data.errorMessage ? `<p><strong>Reason:</strong> ${data.errorMessage}</p>` : ''}
          <p>Please try again or contact support if the issue persists.</p>
        </div>
      `
    } else {
      return `
        <div class="additional-info" style="border-left: 4px solid #f39c12;">
          <h4>Transaction Processing</h4>
          <p>Your ${transactionType} request of <strong>${amount} ${currency}</strong> is currently being processed.</p>
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
        <div class="additional-info">
          <h4>Staking Information</h4>
          <p>Your staking positions are now earning rewards.</p>
          <ul>
            <li>Daily reward rate: <strong>${data.dailyPercentage}%</strong></li>
            <li>Staking period: <strong>${data.stakingPeriod} days</strong></li>
            <li>Expected total return: <strong>${((data.dailyPercentage || 0) * (data.stakingPeriod || 0)).toFixed(2)}%</strong></li>
          </ul>
          <p>Rewards will be distributed to your account automatically.</p>
        </div>
      `
    }

    if (data.transactionType === 'withdrawal' && data.status === 'success') {
      return `
        <div class="additional-info">
          <h4>Withdrawal Information</h4>
          <p>Your withdrawal has been processed and transferred to your specified wallet address.</p>
          <p>Please allow time for blockchain confirmation.</p>
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

  private getWelcomeEmailTemplate(data: WelcomeEmailData): { subject: string; html: string } {
    const { userName, referralCode } = data
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Jarvis Staking Platform</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
          .welcome-content { padding: 20px 0; }
          .feature-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
          .feature-title { font-weight: bold; color: #667eea; margin-bottom: 10px; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .referral-box { background: #e8f5e8; border: 2px solid #4caf50; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .highlight { color: #667eea; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚀 Welcome to Jarvis Staking!</h1>
            <p>Your Gateway to Smart Cryptocurrency Staking</p>
          </div>
          
          <div class="welcome-content">
            <h2>Hello <span class="highlight">${userName}</span>! 👋</h2>
            
            <p>Welcome to the Jarvis Staking Platform! We're thrilled to have you join our community of smart investors who are earning passive income through our innovative staking solutions.</p>
            
            <div class="feature-box">
              <div class="feature-title">🎯 USDT Staking Plan</div>
              <p>Start earning <strong>5% daily returns</strong> with our flagship USDT staking plan. Minimum investment starts at just $10!</p>
            </div>
            
            <div class="feature-box">
              <div class="feature-title">🪙 JRC Rewards</div>
              <p>Earn <strong>100 JRC tokens</strong> for every $10 you invest. These tokens can be staked for additional rewards!</p>
            </div>
            
            <div class="feature-box">
              <div class="feature-title">💰 Referral Program</div>
              <p>Invite friends and earn commissions on their investments. Build your passive income network!</p>
            </div>
            
            ${referralCode ? `
            <div class="referral-box">
              <h3>🎉 You joined through a referral!</h3>
              <p>You're already part of our growing community network. Start investing to unlock additional benefits!</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://jarvisstaking.live'}/dashboard" class="cta-button">
                🚀 Start Staking Now
              </a>
            </div>
            
            <div class="feature-box">
              <div class="feature-title">📈 Next Steps</div>
              <ol>
                <li><strong>Complete your profile</strong> - Add any additional information</li>
                <li><strong>Make your first deposit</strong> - Fund your account with USDT</li>
                <li><strong>Choose your staking plan</strong> - Start earning daily returns</li>
                <li><strong>Invite friends</strong> - Share your referral link and earn more</li>
              </ol>
            </div>
            
            <p>If you have any questions or need assistance, our support team is here to help. Simply reply to this email or contact us through the platform.</p>
            
            <p>Happy staking! 🎉</p>
          </div>
          
          <div class="footer">
            <p><strong>Jarvis Staking Platform</strong></p>
            <p>Smart Staking • Passive Income • Secure Platform</p>
            <p><small>This is an automated welcome message. For support, please contact us through the platform.</small></p>
          </div>
        </div>
      </body>
      </html>
    `

    return {
      subject: '🚀 Welcome to Jarvis Staking - Start Earning Today!',
      html
    }
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    try {
      const { subject, html } = this.getWelcomeEmailTemplate(data)

      const mailOptions = {
        from: `"Jarvis Staking Platform" <${process.env.SMTP_USER}>`,
        to: data.userEmail,
        subject,
        html
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log('Welcome email sent successfully:', result.messageId)
      return true
    } catch (error) {
      console.error('Error sending welcome email:', error)
      return false
    }
  }
}

export default EmailService
