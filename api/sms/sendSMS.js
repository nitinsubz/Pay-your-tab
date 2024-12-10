'use server';

import twilio from 'twilio';

const accountSid = 'AC7519294cd623db832f43021abf07e7f5';
const authToken = '4779a1fd02b13e952a0b492c7aaee8f2';
const client = twilio(accountSid, authToken);

export async function sendSMS({ message, recipients }) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('Recipients list must be a non-empty array.');
  }
  console.log("WE IN THE SERVER")
  try {
    // const promises = recipients.map((number) =>
    //   client.messages.create({
    //     body: "TESTING",
    //     from: '+14244333341',
    //     to: '+14084976281',
    //   })
    // );
    // await Promise.all(promises);
    const message = await client.messages.create({
      body: "Hello from your Messaging Service!",
      messagingServiceSid: "MG3e39e9579e35ea4d1b56ec0b93e75cee",
      to: "+14084976281",
    });
  
    console.log("SUCCESS")
    return { success: true };
  } catch (error) {
    console.error('Error sending text blast:', error);
    throw new Error('Failed to send messages. Please try again later.');
  }
}
