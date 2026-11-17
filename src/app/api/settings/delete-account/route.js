import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import User from '@/models/User';
import Space from '@/models/Space';
import Transaction from '@/models/Transaction';
import ExpenseTitle from '@/models/ExpenseTitle';
import MonthlySummary from '@/models/MonthlySummary';
import PaymentAttempt from '@/models/PaymentAttempt';
import NotificationEvent from '@/models/NotificationEvent';
import Consent from '@/models/Consent';
import DeviceToken from '@/models/DeviceToken';
import MerchantMapping from '@/models/MerchantMapping';

export const dynamic = 'force-dynamic';

export async function DELETE(request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  await connectDB();

  try {
    const userId = auth.user._id;

    await Transaction.deleteMany({ userId });
    await ExpenseTitle.deleteMany({ userId });
    await MonthlySummary.deleteMany({ userId });
    await Space.deleteMany({ userId });
    await PaymentAttempt.deleteMany({ userId });
    await NotificationEvent.deleteMany({ userId });
    await Consent.deleteMany({ userId });
    await DeviceToken.deleteMany({ userId });
    await MerchantMapping.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    const cookieStore = await cookies();
    cookieStore.delete('token');

    return NextResponse.json({ message: 'Your account and all associated financial data have been permanently deleted.' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json({ message: 'Server error deleting account' }, { status: 500 });
  }
}
