const Payment = require('../models/Payment');
const Reservation = require('../models/Reservation');
const cloudinary = require('../config/cloudinary');

// Get payment methods (bank accounts & e-wallets)
const getPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = {
      bankAccounts: [
        {
          id: 1,
          bankName: "Bank BCA",
          accountNumber: "1234567890",
          accountName: "BroCode Barbershop",
          logo: "https://res.cloudinary.com/demo/image/upload/bca_logo.png"
        },
        {
          id: 2,
          bankName: "Bank Mandiri", 
          accountNumber: "0987654321",
          accountName: "BroCode Barbershop",
          logo: "https://res.cloudinary.com/demo/image/upload/mandiri_logo.png"
        },
        {
          id: 3,
          bankName: "Bank BRI",
          accountNumber: "5555666677",
          accountName: "BroCode Barbershop",
          logo: "https://res.cloudinary.com/demo/image/upload/bri_logo.png"
        }
      ],
      eWallets: [
        {
          id: 1,
          walletType: "GoPay",
          walletNumber: "081234567890",
          walletName: "BroCode Barbershop",
          logo: "https://res.cloudinary.com/demo/image/upload/gopay_logo.png"
        },
        {
          id: 2,
          walletType: "OVO",
          walletNumber: "081234567890", 
          walletName: "BroCode Barbershop",
          logo: "https://res.cloudinary.com/demo/image/upload/ovo_logo.png"
        },
        {
          id: 3,
          walletType: "DANA",
          walletNumber: "081234567890",
          walletName: "BroCode Barbershop",
          logo: "https://res.cloudinary.com/demo/image/upload/dana_logo.png"
        },
        {
          id: 4,
          walletType: "ShopeePay",
          walletNumber: "081234567890",
          walletName: "BroCode Barbershop",
          logo: "https://res.cloudinary.com/demo/image/upload/shopeepay_logo.png"
        }
      ]
    };

    res.status(200).json({
      success: true,
      message: "Payment methods retrieved successfully",
      data: paymentMethods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving payment methods",
      error: error.message
    });
  }
};

// Upload payment proof
const uploadPaymentProof = async (req, res) => {
  try {
    const { reservationId, paymentMethod, selectedAccount } = req.body;
    
    console.log('Upload payment proof request:', {
      reservationId,
      paymentMethod,
      selectedAccount: typeof selectedAccount === 'string' ? selectedAccount : JSON.stringify(selectedAccount),
      file: req.file ? 'File uploaded' : 'No file',
      userId: req.user.userId || req.user.id
    });

    // Validate required fields
    if (!reservationId || !paymentMethod || !selectedAccount) {
      return res.status(400).json({
        success: false,
        message: "reservationId, paymentMethod, and selectedAccount are required"
      });
    }

    // Validate reservation exists and belongs to user
    const reservation = await Reservation.findById(reservationId)
      .populate('customer', '_id userId')
      .populate('package', 'name price');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: "Reservation not found"
      });
    }

    // Check if user owns this reservation
    const userIdentifier = req.user.userId || req.user.id;
    let userOwnsReservation = false;

    if (typeof userIdentifier === 'string' && userIdentifier.startsWith('USR-')) {
      // If userIdentifier is userId string like "USR-001"
      userOwnsReservation = reservation.customer.userId === userIdentifier;
    } else {
      // If userIdentifier is MongoDB _id
      userOwnsReservation = reservation.customer._id.toString() === userIdentifier;
    }

    if (!userOwnsReservation) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only upload payment for your own reservations."
      });
    }

    // Check if reservation status allows payment - hanya 'pending' yang diizinkan
    if (reservation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot upload payment proof. Reservation status: ${reservation.status}. Only pending reservations can upload payment.`
      });
    }

    // Check if payment already exists for this reservation
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
      // If selectedAccount is already an object, use it directly
      if (typeof selectedAccount === 'object' && selectedAccount !== null) {
        accountDetails = selectedAccount;
      } else if (typeof selectedAccount === 'string') {
        let jsonString = selectedAccount.trim();
        
        // Handle case where string contains "selectedAccount: {JSON}" format
        if (jsonString.startsWith('selectedAccount:')) {
          jsonString = jsonString.replace(/^selectedAccount:\s*/, '').trim();
        }
        
        // Remove any trailing newlines or whitespace
        jsonString = jsonString.replace(/\n$/, '').trim();
        
        // Try to parse JSON string
        accountDetails = JSON.parse(jsonString);
      } else {
        throw new Error('selectedAccount must be an object or valid JSON string');
      }

      // Validate accountDetails has required fields
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
          value: selectedAccount,
          cleanedValue: typeof selectedAccount === 'string' ? 
            selectedAccount.replace(/^selectedAccount:\s*/, '').trim().replace(/\n$/, '') : 
            'Not a string'
        }
      });
    }

    // Generate paymentId manually to ensure it's created
    const paymentCount = await Payment.countDocuments();
    const paymentId = `PAY${String(paymentCount + 1).padStart(3, '0')}`;

    // Create payment record
    const paymentData = {
      paymentId: paymentId, // Explicitly set paymentId
      reservationId: reservation._id,
      userId: reservation.customer._id,
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

    console.log('Creating payment with data:', paymentData);

    const payment = new Payment(paymentData);
    await payment.save();

    console.log('Payment saved successfully:', payment.paymentId);

    // TIDAK update reservation status - tetap 'pending' sampai cashier verify
    // Hanya simpan referensi payment ID
    reservation.paymentId = payment._id;
    await reservation.save();

    console.log('Reservation updated with payment ID');

    res.status(201).json({
      success: true,
      message: "Payment proof uploaded successfully. Please wait for cashier verification to confirm your reservation.",
      data: {
        paymentId: payment.paymentId,
        reservationId: reservation._id,
        reservationStatus: reservation.status, // masih 'pending'
        paymentStatus: payment.status, // 'pending'
        proofUrl: payment.proofOfPayment.url,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod
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

    // Update payment
    payment.status = status;
    payment.verificationNote = verificationNote || '';
    payment.verifiedBy = req.user.userId || req.user.id;
    payment.verifiedAt = new Date();
    await payment.save();

    // Update reservation status - INI YANG BERUBAH
    const reservation = payment.reservationId;
    if (status === 'verified') {
      // Jika payment verified, maka reservation otomatis confirmed
      reservation.status = 'confirmed';
      reservation.confirmedAt = new Date();
      reservation.confirmedBy = req.user.userId || req.user.id;
    } else {
      // Jika payment rejected, maka reservation cancelled
      reservation.status = 'cancelled';
      reservation.cancelledAt = new Date();
      reservation.cancelReason = verificationNote || 'Payment rejected by cashier';
    }
    await reservation.save();

    const message = status === 'verified' 
      ? 'Payment verified and reservation confirmed successfully' 
      : 'Payment rejected and reservation cancelled';

    res.status(200).json({
      success: true,
      message: message,
      data: {
        paymentId: payment.paymentId,
        reservationId: reservation._id,
        paymentStatus: payment.status,
        reservationStatus: reservation.status,
        verificationNote: payment.verificationNote,
        actionTaken: status === 'verified' ? 'Reservation Confirmed' : 'Reservation Cancelled'
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
  getPaymentMethods,
  uploadPaymentProof,
  getPaymentDetails,
  getPendingPayments,
  getPendingReservationsWithPayment,
  getPaymentById,
  verifyPayment
};