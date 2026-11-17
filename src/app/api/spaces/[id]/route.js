import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getAuthenticatedUser, unauthorized } from '@/lib/auth';
import Space from '@/models/Space';
import Transaction from '@/models/Transaction';
import ExpenseTitle from '@/models/ExpenseTitle';
import MonthlySummary from '@/models/MonthlySummary';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const { name, isDefault } = body;

  try {
    await connectDB();
    let space = await Space.findOne({ _id: id, userId: auth.user._id });
    if (!space) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    if (name && name.trim()) {
      const trimmedName = name.trim();
      const duplicate = await Space.findOne({
        _id: { $ne: space._id },
        userId: auth.user._id,
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });
      if (duplicate) {
        return NextResponse.json({ message: 'Another space with this name already exists' }, { status: 400 });
      }
      space.name = trimmedName;
    }

    if (isDefault === true && !space.isDefault) {
      await Space.updateMany({ userId: auth.user._id }, { isDefault: false });
      space.isDefault = true;
    }

    await space.save();
    return NextResponse.json(space);
  } catch (error) {
    console.error('Error updating space:', error.message);
    return NextResponse.json({ message: 'Server error updating space' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return unauthorized();

  const { id } = await params;

  try {
    await connectDB();
    const space = await Space.findOne({ _id: id, userId: auth.user._id });
    if (!space) {
      return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    }

    if (space.isDefault) {
      return NextResponse.json(
        { message: 'Cannot delete your default space. Set another space as default first.' },
        { status: 400 }
      );
    }

    const totalSpaces = await Space.countDocuments({ userId: auth.user._id });
    if (totalSpaces <= 1) {
      return NextResponse.json({ message: 'Cannot delete the only remaining space.' }, { status: 400 });
    }

    // Cascade delete
    await Transaction.deleteMany({ spaceId: space._id });
    await ExpenseTitle.deleteMany({ spaceId: space._id });
    await MonthlySummary.deleteMany({ spaceId: space._id });
    await space.deleteOne();

    return NextResponse.json({ message: 'Space and all associated history successfully deleted' });
  } catch (error) {
    console.error('Error deleting space:', error.message);
    return NextResponse.json({ message: 'Server error deleting space' }, { status: 500 });
  }
}
