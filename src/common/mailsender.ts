import nodemailer from 'nodemailer';
import { TransportOptions } from 'nodemailer';
import { envConfig } from '../utils';

export class MailSender {

  transporter: nodemailer.Transporter;
  adminEmail: string;

  constructor(service: string, host: string, user: string, pass: string) {
    this.transporter = nodemailer.createTransport({
      service,
      host,
      auth: {
        user,
        pass,
      }
    } as TransportOptions);
    this.adminEmail = user;
  }

  sendEmail(to: string|string[], subject: string, content: string) {
    const target: string[] = Array.isArray(to) ? to : [to];
    this.transporter.sendMail({
      from: `"Admin" <${this.adminEmail}>`,
      to: target.join(','),
      subject,
      html: content,
    });
  }

  static getInstance(): MailSender {
    const globalContext = (global as any);
    if (!globalContext.$emailer) {
      globalContext.$emailer = new MailSender(
        envConfig('EMAIL_SENDER_SERVICE'),
        envConfig('EMAIL_SENDER_HOST'),
        envConfig('EMAIL_SENDER_USER'),
        envConfig('EMAIL_SENDER_PASS')
      );
    }
    return globalContext.$emailer;
  }

}
