import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// TronGrid API for TRC-20 transaction lookups
const TRONGRID_API = 'https://api.trongrid.io';

// USDT TRC-20 contract address on Tron mainnet
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// Minimum confirmations required for deposit verification
const MIN_CONFIRMATIONS = 19;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { txHash, orderId, userAddress } = await req.json();

    if (!txHash) {
      return new Response(
        JSON.stringify({ error: 'Transaction hash is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Fetch transaction info from TronGrid
    const txInfoRes = await fetch(
      `${TRONGRID_API}/v1/transactions/${txHash}`,
      { headers: { 'TRON-PRO-API-KEY': Deno.env.get('TRONGRID_API_KEY') || '' } },
    );

    if (!txInfoRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found on Tron network', verified: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const txInfo = await txInfoRes.json();
    const txData = txInfo.data?.[0];

    if (!txData) {
      return new Response(
        JSON.stringify({ error: 'Transaction data not found', verified: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Check if transaction is confirmed
    const blockRes = await fetch(`${TRONGRID_API}/wallet/getblockbylatest`);
    const blockData = await blockRes.json();
    const latestBlock = blockData?.block_header?.raw_data?.number || 0;
    const txBlock = txData?.blockNumber || 0;
    const confirmations = latestBlock > 0 && txBlock > 0 ? latestBlock - txBlock : 0;

    // 3. Parse TRC-20 transfer data
    // Look for the transfer event in the transaction
    const contractData = txData?.smartContractData;
    const transfers = txData?.trc20TransferInfo || txData?.transfers || [];

    let foundTransfer: { from: string; to: string; value: string; contract: string } | null = null;

    for (const transfer of transfers) {
      if (
        transfer.contract_address === USDT_CONTRACT ||
        transfer.tokenInfo?.symbol === 'USDT'
      ) {
        foundTransfer = {
          from: transfer.from_address || transfer.from || '',
          to: transfer.to_address || transfer.to || '',
          value: transfer.value || transfer.amount || '0',
          contract: transfer.contract_address || USDT_CONTRACT,
        };
        break;
      }
    }

    if (!foundTransfer) {
      return new Response(
        JSON.stringify({ error: 'No USDT TRC-20 transfer found in this transaction', verified: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Verify the receiving address matches our platform address
    const platformAddress = Deno.env.get('PLATFORM_TRON_ADDRESS');
    if (platformAddress && foundTransfer.to !== platformAddress) {
      return new Response(
        JSON.stringify({ error: 'Deposit was not sent to the platform address', verified: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5. Check confirmation count
    const isConfirmed = confirmations >= MIN_CONFIRMATIONS;
    const amount = parseFloat(foundTransfer.value) / 1_000_000; // USDT has 6 decimals

    // 6. Record the deposit scan
    const { data: existingScan } = await supabase
      .from('deposit_scans')
      .select('*')
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (!existingScan) {
      await supabase.from('deposit_scans').insert({
        tx_hash: txHash,
        from_address: foundTransfer.from,
        to_address: foundTransfer.to,
        amount: amount,
        confirmations: confirmations,
        status: isConfirmed ? 'confirmed' : 'detected',
        block_number: txBlock,
        matched_order_id: orderId || null,
        matched_user_id: userAddress || null,
      });
    } else {
      await supabase.from('deposit_scans').update({
        confirmations: confirmations,
        status: isConfirmed ? 'confirmed' : 'detected',
      }).eq('tx_hash', txHash);
    }

    // 7. If confirmed and matched to an order, update the order
    if (isConfirmed && orderId) {
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (order && order.status === 'pending_deposit') {
        await supabase.from('orders').update({
          status: 'deposit_confirmed',
          deposit_status: 'confirmed',
          deposit_confirmed_at: new Date().toISOString(),
          tx_hash: txHash,
          deposit_amount: amount,
          deposit_confirmations: confirmations,
        }).eq('id', orderId);

        // Notify the user
        await supabase.from('notifications').insert({
          user_id: order.user_id,
          title: 'Deposit confirmed',
          message: `Your USDT deposit of ${amount} USDT has been confirmed on-chain (TRC-20). Your order ${order.order_number} is now being processed for INR payout.`,
          type: 'payment',
          link: '/app/orders',
        });
      }
    }

    return new Response(
      JSON.stringify({
        verified: true,
        confirmed: isConfirmed,
        confirmations: confirmations,
        amount: amount,
        from: foundTransfer.from,
        to: foundTransfer.to,
        txHash: txHash,
        message: isConfirmed
          ? 'Deposit confirmed on-chain'
          : `Deposit detected, waiting for confirmations (${confirmations}/${MIN_CONFIRMATIONS})`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, verified: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
