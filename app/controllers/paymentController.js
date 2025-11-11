const { Payment, PaymentOption } = require('../models/Payment');
const Reservation = require('../models/Reservation');
const cloudinary = require('../config/cloudinary');
const User = require('../models/User');

// ========================
// PAYMENT OPTION FUNCTIONS
// ========================

// Get all payment options
const getAllPaymentOptions = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    
    let query = {};
    
    if (type) {
      query.type = type;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const paymentOptions = await PaymentOption.find(query)
      .sort({ type: 1, sortOrder: 1, name: 1 });

    // Group by type for better organization
    const groupedOptions = {
      bank_transfer: [],
      e_wallet: []
    };

    paymentOptions.forEach(option => {
      groupedOptions[option.type].push(option);
    });

    res.json({
      success: true,
      message: "Payment options retrieved successfully",
      data: {
        all: paymentOptions,
        grouped: groupedOptions,
        totals: {
          banks: groupedOptions.bank_transfer.length,
          eWallets: groupedOptions.e_wallet.length,
          total: paymentOptions.length
        }
      }
    });

  } catch (error) {
    console.error('Get payment options error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment options",
      error: error.message
    });
  }
};

// Get active payment options (Public) - REPLACES getPaymentMethods
const getPaymentMethods = async (req, res) => {
  try {
    const { type } = req.query;
    
    let query = { isActive: true };
    
    if (type) {
      query.type = type;
    }

    const paymentOptions = await PaymentOption.find(query)
      .select('-createdAt -updatedAt')
      .sort({ type: 1, sortOrder: 1, name: 1 });

    // Group by type for backwards compatibility
    const groupedOptions = {
      bankAccounts: [],
      eWallets: []
    };

    paymentOptions.forEach(option => {
      const optionData = {
        id: option._id,
        optionId: option.optionId,
        name: option.name
        // Removed displayName and description
      };

      if (option.type === 'bank_transfer') {
        optionData.bankName = option.name;
        optionData.accountNumber = option.accountNumber;
        optionData.accountName = option.accountName;
        groupedOptions.bankAccounts.push(optionData);
      } else if (option.type === 'e_wallet') {
        optionData.walletType = option.name;
        optionData.walletNumber = option.phoneNumber;
        optionData.walletName = option.walletName;
        groupedOptions.eWallets.push(optionData);
      }
    });

    res.status(200).json({
      success: true,
      message: "Payment methods retrieved successfully",
      data: groupedOptions
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payment methods",
      error: error.message
    });
  }
};

// Get payment option by ID
const getPaymentOptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const paymentOption = await PaymentOption.findById(id);

    if (!paymentOption) {
      return res.status(404).json({
        success: false,
        message: "Payment option not found"
      });
    }

    res.json({
      success: true,
      message: "Payment option retrieved successfully",
      data: paymentOption
    });

  } catch (error) {
    console.error('Get payment option by ID error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment option",
      error: error.message
    });
  }
};

// Create payment option
const createPaymentOption = async (req, res) => {
  try {
    const {
      type,
      name,
      accountNumber,
      accountName,
      phoneNumber,
      walletName,
      sortOrder,
      isActive = true
    } = req.body;

    // Validate required fields - REMOVED displayName
    if (!type || !name) {
      return res.status(400).json({
        success: false,
        message: "Type and name are required"
      });
    }

    // Validate type-specific fields
    if (type === 'bank_transfer') {
      if (!accountNumber || !accountName) {
        return res.status(400).json({
          success: false,
          message: "Account number and account name are required for bank transfer"
        });
      }
    } else if (type === 'e_wallet') {
      if (!phoneNumber || !walletName) {
        return res.status(400).json({
          success: false,
          message: "Phone number and wallet name are required for e-wallet"
        });
      }
    }

    // Check for duplicate name within same type
    const existingOption = await PaymentOption.findOne({
      type: type,
      name: name.toLowerCase(),
      isActive: true
    });

    if (existingOption) {
      return res.status(400).json({
        success: false,
        message: `${type === 'bank_transfer' ? 'Bank' : 'E-wallet'} with this name already exists`
      });
    }

    // Create payment option - REMOVED description and displayName
    const paymentOptionData = {
      type,
      name: name.trim(),
      sortOrder: sortOrder || 0,
      isActive
    };

    if (type === 'bank_transfer') {
      paymentOptionData.accountNumber = accountNumber.trim();
      paymentOptionData.accountName = accountName.trim();
    } else if (type === 'e_wallet') {
      paymentOptionData.phoneNumber = phoneNumber.trim();
      paymentOptionData.walletName = walletName.trim();
    }

    const paymentOption = new PaymentOption(paymentOptionData);
    const savedPaymentOption = await paymentOption.save();

    res.status(201).json({
      success: true,
      message: "Payment option created successfully",
      data: savedPaymentOption
    });

  } catch (error) {
    console.error('Create payment option error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Payment option with this name already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create payment option",
      error: error.message
    });
  }
};

// Update payment option
const updatePaymentOption = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      name,
      accountNumber,
      accountName,
      phoneNumber,
      walletName,
      sortOrder,
      isActive
    } = req.body;

    const paymentOption = await PaymentOption.findById(id);

    if (!paymentOption) {
      return res.status(404).json({
        success: false,
        message: "Payment option not found"
      });
    }

    // Validate type-specific fields if type is being changed
    const newType = type || paymentOption.type;
    
    if (newType === 'bank_transfer') {
      if (!accountNumber && !paymentOption.accountNumber || !accountName && !paymentOption.accountName) {
        return res.status(400).json({
          success: false,
          message: "Account number and account name are required for bank transfer"
        });
      }
    } else if (newType === 'e_wallet') {
      if (!phoneNumber && !paymentOption.phoneNumber || !walletName && !paymentOption.walletName) {
        return res.status(400).json({
          success: false,
          message: "Phone number and wallet name are required for e-wallet"
        });
      }
    }

    // Update fields - REMOVED description and displayName
    if (type) paymentOption.type = type;
    if (name) paymentOption.name = name.trim();
    if (sortOrder !== undefined) paymentOption.sortOrder = sortOrder;
    if (isActive !== undefined) paymentOption.isActive = isActive;

    // Update type-specific fields
    if (newType === 'bank_transfer') {
      if (accountNumber) paymentOption.accountNumber = accountNumber.trim();
      if (accountName) paymentOption.accountName = accountName.trim();
      // Clear e-wallet fields
      paymentOption.phoneNumber = undefined;
      paymentOption.walletName = undefined;
    } else if (newType === 'e_wallet') {
      if (phoneNumber) paymentOption.phoneNumber = phoneNumber.trim();
      if (walletName) paymentOption.walletName = walletName.trim();
      // Clear bank fields
      paymentOption.accountNumber = undefined;
      paymentOption.accountName = undefined;
    }

    const updatedPaymentOption = await paymentOption.save();

    res.json({
      success: true,
      message: "Payment option updated successfully",
      data: updatedPaymentOption
    });

  } catch (error) {
    console.error('Update payment option error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment option",
      error: error.message
    });
  }
};

// Delete payment option
const deletePaymentOption = async (req, res) => {
  try {
    const { id } = req.params;

    const paymentOption = await PaymentOption.findById(id);

    if (!paymentOption) {
      return res.status(404).json({
        success: false,
        message: "Payment option not found"
      });
    }

    // Check if payment option is being used in any payments
    const isUsed = await Payment.findOne({
      $or: [
        { 'bankAccount.bankName': paymentOption.name },
        { 'eWallet.walletType': paymentOption.name }
      ]
    });

    if (isUsed) {
      // Soft delete - just deactivate
      paymentOption.isActive = false;
      await paymentOption.save();

      return res.json({
        success: true,
        message: "Payment option deactivated successfully (cannot delete - still referenced in payments)",
        data: paymentOption
      });
    }

    // Hard delete if not referenced
    await PaymentOption.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Payment option deleted successfully",
      data: {
        _id: id,
        name: paymentOption.name,
        type: paymentOption.type
      }
    });

  } catch (error) {
    console.error('Delete payment option error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete payment option",
      error: error.message
    });
  }
};

// Toggle payment option status
const togglePaymentOptionStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const paymentOption = await PaymentOption.findById(id);

    if (!paymentOption) {
      return res.status(404).json({
        success: false,
        message: "Payment option not found"
      });
    }

    paymentOption.isActive = !paymentOption.isActive;
    const updatedPaymentOption = await paymentOption.save();

    res.json({
      success: true,
      message: `Payment option ${paymentOption.isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedPaymentOption
    });

  } catch (error) {
    console.error('Toggle payment option status error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle payment option status",
      error: error.message
    });
  }
};

// ========================
// EXISTING PAYMENT FUNCTIONS (unchanged)
// ========================

// Upload payment proof
const uploadPaymentProof = async (req, res) => {
  try {
    const { reservationId, paymentMethod, selectedAccount } = req.body;
    
    // Validate required fields
    if (!reservationId || !paymentMethod || !selectedAccount) {
      return res.status(400).json({
        success: false,
        message: "reservationId, paymentMethod, and selectedAccount are required"
      });
    }

    // Validate reservation exists
    const reservation = await Reservation.findById(reservationId)
      .populate('createdBy', '_id userId')
      .populate('package', 'name price');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    // ✅ SIMPLIFIED AUTHORIZATION: Only check createdBy
    const userIdentifier = req.user.userId || req.user.id;
    let currentUser;
    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      currentUser = await User.findOne({ userId: userIdentifier }).select('_id userId');
    } else {
      currentUser = await User.findById(userIdentifier).select('_id userId');
    }

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ AUTHORIZATION: Only createdBy can upload payment
    if (reservation.createdBy._id.toString() !== currentUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only upload payment for reservations you created."
      });
    }

    // Check if reservation status allows payment
    if (reservation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot upload payment proof. Reservation status: ${reservation.status}. Only pending reservations can upload payment.`
      });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ reservationId: reservation._id });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment proof has already been uploaded for this reservation"
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Payment proof file is required"
      });
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'payment-proofs',
          public_id: `payment_${reservationId}_${Date.now()}`,
          resource_type: 'auto',
          transformation: [
            { width: 800, height: 600, crop: 'limit' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      stream.end(req.file.buffer);
    });

    console.log('Cloudinary upload successful:', uploadResult.secure_url);

    // Parse selectedAccount with better error handling
    let accountDetails;
    try {
      if (typeof selectedAccount === 'object' && selectedAccount !== null) {
        accountDetails = selectedAccount;
      } else if (typeof selectedAccount === 'string') {
        let jsonString = selectedAccount.trim();
        
        if (jsonString.startsWith('selectedAccount:')) {
          jsonString = jsonString.replace(/^selectedAccount:\s*/, '').trim();
        }
        
        jsonString = jsonString.replace(/\n$/, '').trim();
        accountDetails = JSON.parse(jsonString);
      } else {
        throw new Error('selectedAccount must be an object or valid JSON string');
      }

      if (!accountDetails || typeof accountDetails !== 'object') {
        throw new Error('selectedAccount must contain account details');
      }

      // Validate based on payment method
      if (paymentMethod === 'bank_transfer') {
        if (!accountDetails.bankName || !accountDetails.accountNumber || !accountDetails.accountName) {
          throw new Error('Bank transfer requires bankName, accountNumber, and accountName');
        }
      } else if (paymentMethod === 'e_wallet') {
        if (!accountDetails.walletType || !accountDetails.walletNumber || !accountDetails.walletName) {
          throw new Error('E-wallet requires walletType, walletNumber, and walletName');
        }
      }

    } catch (parseError) {
      console.error('selectedAccount parsing error:', parseError);
      return res.status(400).json({
        success: false,
        message: `Invalid selectedAccount format: ${parseError.message}`,
        receivedData: {
          type: typeof selectedAccount,
          value: selectedAccount
        }
      });
    }

    // Generate paymentId manually
    const paymentCount = await Payment.countDocuments();
    const paymentId = `PAY${String(paymentCount + 1).padStart(3, '0')}`;

    // Create payment record
    const paymentData = {
      paymentId: paymentId,
      reservationId: reservation._id,
      userId: currentUser._id, // ✅ Use createdBy as userId
      amount: reservation.totalPrice || reservation.package.price,
      paymentMethod,
      proofOfPayment: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        originalName: req.file.originalname
      }
    };

    // Add account details based on payment method
    if (paymentMethod === 'bank_transfer') {
      paymentData.bankAccount = {
        bankName: accountDetails.bankName,
        accountNumber: accountDetails.accountNumber,
        accountName: accountDetails.accountName
      };
    } else if (paymentMethod === 'e_wallet') {
      paymentData.eWallet = {
        walletType: accountDetails.walletType,
        walletNumber: accountDetails.walletNumber,
        walletName: accountDetails.walletName
      };
    }

    const payment = new Payment(paymentData);
    await payment.save();

    // Update reservation with payment reference
    reservation.paymentId = payment._id;
    await reservation.save();

    res.status(201).json({
      success: true,
      message: "Payment proof uploaded successfully. Please wait for cashier verification to confirm your reservation.",
      data: {
        paymentId: payment.paymentId,
        reservationId: reservation._id,
        reservationStatus: reservation.status,
        paymentStatus: payment.status,
        proofUrl: payment.proofOfPayment.url,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        uploadedBy: currentUser.userId || currentUser._id
      }
    });

  } catch (error) {
    console.error('Upload payment proof error:', error);
    res.status(500).json({
      success: false,
      message: "Error uploading payment proof",
      error: error.message
    });
  }
};

// Get payment details by reservation ID
const getPaymentDetails = async (req, res) => {
  try {
    const { reservationId } = req.params;
    
    const payment = await Payment.findOne({ reservationId })
      .populate({
        path: 'reservationId',
        select: 'totalPrice status',
        populate: {
          path: 'package',
          select: 'name price'
        }
      })
      .populate('userId', 'name email phone userId')
      .populate('verifiedBy', 'name role');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found for this reservation"
      });
    }

    // Check access rights
    const userIdentifier = req.user.userId || req.user.id;
    let isOwner = false;

    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      isOwner = payment.userId.userId === userIdentifier;
    } else {
      isOwner = payment.userId._id.toString() === userIdentifier;
    }

    const isAdmin = ['admin', 'cashier'].includes(req.user.role?.toLowerCase());

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment details retrieved successfully",
      data: payment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving payment details",
      error: error.message
    });
  }
};

// Get all pending payments (Admin/Cashier only)
const getPendingPayments = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    
    const query = status === 'all' ? {} : { status };
    
    const payments = await Payment.find(query)
      .populate({
        path: 'reservationId',
        select: 'status customerName customerPhone reservationId totalPrice createdAt',
        populate: [
          { path: 'package', select: 'name price description' },
          { path: 'barber', select: 'name' },
          { path: 'schedule', select: 'scheduled_time' },
          { path: 'customer', select: 'name email phone userId' }
        ]
      })
      .populate('userId', 'name email phone userId')
      .populate('verifiedBy', 'name role')
      .sort({ createdAt: -1 });

    // Format data untuk cashier - include semua info yang dibutuhkan
    const formattedPayments = payments.map(payment => ({
      // Payment Info
      paymentId: payment.paymentId,
      _id: payment._id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      
      // Payment Proof - INI YANG PENTING UNTUK CASHIER
      proofOfPayment: {
        url: payment.proofOfPayment.url,
        originalName: payment.proofOfPayment.originalName
      },
      
      // Bank/Wallet Details
      bankAccount: payment.bankAccount || null,
      eWallet: payment.eWallet || null,
      
      // Verification Info
      verificationNote: payment.verificationNote,
      verifiedBy: payment.verifiedBy,
      verifiedAt: payment.verifiedAt,
      
      // Reservation Info
      reservation: {
        _id: payment.reservationId._id,
        reservationId: payment.reservationId.reservationId,
        status: payment.reservationId.status,
        totalPrice: payment.reservationId.totalPrice,
        customerName: payment.reservationId.customerName,
        customerPhone: payment.reservationId.customerPhone,
        createdAt: payment.reservationId.createdAt,
        
        // Package Info
        package: {
          name: payment.reservationId.package?.name,
          price: payment.reservationId.package?.price,
          description: payment.reservationId.package?.description
        },
        
        // Barber Info
        barber: {
          name: payment.reservationId.barber?.name
        },
        
        // Schedule Info
        schedule: {
          scheduled_time: payment.reservationId.schedule?.scheduled_time
        },
        
        // Customer Info
        customer: payment.reservationId.customer
      },
      
      // Customer Info (dari payment)
      customer: payment.userId,
      
      // Timestamps
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: "Payments retrieved successfully",
      data: formattedPayments,
      count: formattedPayments.length,
      summary: {
        pending: formattedPayments.filter(p => p.status === 'pending').length,
        verified: formattedPayments.filter(p => p.status === 'verified').length,
        rejected: formattedPayments.filter(p => p.status === 'rejected').length
      }
    });

  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving payments",
      error: error.message
    });
  }
};

// Get payment by ID
const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId)
      .populate({
        path: 'reservationId',
        populate: [
          { path: 'package', select: 'name price description' },
          { path: 'barber', select: 'name specialization' },
          { path: 'schedule', select: 'scheduled_time' }
        ]
      })
      .populate('userId', 'name email phone userId')
      .populate('verifiedBy', 'name role');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment details retrieved successfully",
      data: payment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving payment details",
      error: error.message
    });
  }
};

// Verify payment dan confirm reservation sekaligus (Admin/Cashier only)
const verifyPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, verificationNote } = req.body;

    // Validate status
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'verified' or 'rejected'"
      });
    }

    const payment = await Payment.findById(paymentId)
      .populate('reservationId');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Payment has already been ${payment.status}`
      });
    }

    // ✅ Get cashier ObjectId directly from req.user
    const cashierObjectId = req.user.userId || req.user.id || req.user._id;
    let cashierId;
    
    // If cashierObjectId is string like "USR-001", find the actual MongoDB ObjectId
    if (typeof cashierObjectId === 'string' && cashierObjectId.startsWith('USR-')) {
      const cashier = await User.findOne({ userId: cashierObjectId });
      cashierId = cashier._id; // This is the MongoDB ObjectId
    } else {
      // cashierObjectId is already MongoDB ObjectId
      cashierId = cashierObjectId;
    }

    // Update payment
    payment.status = status;
    payment.verificationNote = verificationNote || '';
    payment.verifiedBy = cashierId; // ✅ Save MongoDB ObjectId
    payment.verifiedAt = new Date();
    await payment.save();

    // Update reservation status
    const reservation = payment.reservationId;
    if (status === 'verified') {
      reservation.status = 'confirmed';
      reservation.confirmedAt = new Date();
      reservation.confirmedBy = cashierId; // ✅ Save MongoDB ObjectId
    } else {
      reservation.status = 'cancelled';
      reservation.cancelledAt = new Date();
      reservation.cancelReason = verificationNote || 'Payment rejected by cashier';
    }
    await reservation.save();

    // Update schedule status
    const Schedule = require('../models/Schedule');
    
    if (status === 'verified') {
      // Schedule tetap booked untuk service
    } else {
      // Kembalikan schedule ke available jika payment rejected
      await Schedule.findByIdAndUpdate(reservation.schedule, {
        status: 'available',
        reservation: null
      });
    }

    const message = status === 'verified' 
      ? 'Payment verified and reservation confirmed successfully' 
      : 'Payment rejected, reservation cancelled, and schedule made available again';

    // ✅ Response dengan cashier ObjectId
    res.status(200).json({
      success: true,
      message: message,
      data: {
        paymentId: payment.paymentId,
        reservationId: reservation._id,
        paymentStatus: payment.status,
        reservationStatus: reservation.status,
        scheduleStatus: status === 'verified' ? 'booked' : 'available',
        verificationNote: payment.verificationNote,
        actionTaken: status === 'verified' ? 'Reservation Confirmed' : 'Reservation Cancelled & Schedule Released',
        cashierId: cashierId, // ✅ Return MongoDB ObjectId (bukan userId string)
        verifiedAt: payment.verifiedAt
      }
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: "Error verifying payment",
      error: error.message
    });
  }
};

// Get pending reservations with payment details (untuk dashboard cashier)
const getPendingReservationsWithPayment = async (req, res) => {
  try {
    // Cari semua reservations yang statusnya 'pending' dan sudah ada paymentId
    const reservations = await Reservation.find({ 
      status: 'pending',
      paymentId: { $exists: true, $ne: null }
    })
    .populate('customer', 'name email phone userId')
    .populate('package', 'name price description')
    .populate('barber', 'name specialization')
    .populate('schedule', 'scheduled_time')
    .populate({
      path: 'paymentId',
      model: 'Payment',
      populate: {
        path: 'verifiedBy',
        select: 'name role'
      }
    })
    .sort({ createdAt: -1 });

    // Format data untuk cashier dashboard
    const formattedReservations = reservations.map(reservation => ({
      // Reservation Info
      reservationId: reservation.reservationId,
      _id: reservation._id,
      status: reservation.status,
      totalPrice: reservation.totalPrice,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      
      // Customer Info
      customer: reservation.customer,
      
      // Service Info
      package: reservation.package,
      barber: reservation.barber,
      schedule: reservation.schedule,
      
      // Payment Info - INI YANG PENTING
      payment: reservation.paymentId ? {
        paymentId: reservation.paymentId.paymentId,
        _id: reservation.paymentId._id,
        amount: reservation.paymentId.amount,
        paymentMethod: reservation.paymentId.paymentMethod,
        status: reservation.paymentId.status,
        
        // BUKTI PAYMENT - INI YANG DILIHAT CASHIER
        proofOfPayment: {
          url: reservation.paymentId.proofOfPayment.url,
          originalName: reservation.paymentId.proofOfPayment.originalName
        },
        
        // Account Details
        bankAccount: reservation.paymentId.bankAccount || null,
        eWallet: reservation.paymentId.eWallet || null,
        
        // Verification Status
        verificationNote: reservation.paymentId.verificationNote,
        verifiedBy: reservation.paymentId.verifiedBy,
        verifiedAt: reservation.paymentId.verifiedAt,
        
        createdAt: reservation.paymentId.createdAt
      } : null,
      
      // Timestamps
      createdAt: reservation.createdAt,
      updatedAt: reservation.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: "Pending reservations with payment details retrieved successfully",
      data: formattedReservations,
      count: formattedReservations.length
    });

  } catch (error) {
    console.error('Get pending reservations with payment error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving pending reservations with payment",
      error: error.message
    });
  }
};

module.exports = {
  // Payment Option functions
  getAllPaymentOptions,
  getPaymentOptionById,
  createPaymentOption,
  updatePaymentOption,
  deletePaymentOption,
  togglePaymentOptionStatus,
  
  // Payment functions (existing)
  getPaymentMethods, // Updated to use PaymentOption
  uploadPaymentProof,
  getPaymentDetails,
  getPendingPayments,
  getPendingReservationsWithPayment,
  getPaymentById,
  verifyPayment
};