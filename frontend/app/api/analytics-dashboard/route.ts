import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { sophonTestnet } from '../../config/chains';
import { kv } from '@vercel/kv';
import storeAbi from '../../abi/nanoMusicStore.json';
import bandAbi from '../../abi/nanoBand.json';
import { corsHeaders } from '../cors';

const STORE_CONTRACT = (process.env.NEXT_PUBLIC_STORE_CONTRACT || '0x86E1D788FFCd8232D85dD7eB02c508e7021EB474') as `0x${string}`; // NanoMusicStore Proxy
const BAND_CONTRACT = (process.env.NEXT_PUBLIC_BAND_CONTRACT || '0xAAfD6b707770BC9F60A773405dE194348B6C4392') as `0x${string}`; // NanoBand Proxy
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3a364f43893C86553574bf28Bcb4a3d7ff0C7c1f') as `0x${string}`; // MockUSDC
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.sophon.xyz';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\n/g, '') || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\n/g, '') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
    const headers = corsHeaders();
    
    try {
        // Initialize blockchain client
        const publicClient = createPublicClient({
            chain: sophonTestnet,
            transport: http(RPC_URL),
        });

        // Get blockchain data
        const [
            totalPurchases,
            giftcardPrice,
            storeBalance,
            bandBalance
        ] = await Promise.all([
            publicClient.readContract({
                address: STORE_CONTRACT,
                abi: storeAbi,
                functionName: 'totalPurchases',
            }) as Promise<bigint>,
            publicClient.readContract({
                address: STORE_CONTRACT,
                abi: storeAbi,
                functionName: 'giftcardPrice',
            }) as Promise<bigint>,
            publicClient.readContract({
                address: STORE_CONTRACT,
                abi: storeAbi,
                functionName: 'getContractBalance',
            }) as Promise<bigint>,
            publicClient.readContract({
                address: BAND_CONTRACT,
                abi: bandAbi,
                functionName: 'getUSDCBalance',
            }) as Promise<bigint>,
        ]);

        // Get KV analytics data
        const [
            uniqueIps,
            totalWalletsGenerated,
            recentWallets,
            walletIndex
        ] = await Promise.all([
            kv.scard('unique_ips'),
            kv.get('total_wallets_generated'),
            kv.lrange('recent_wallets', 0, 9), // Get last 10 wallets
            kv.get('wallet_index')
        ]);

        // Get Supabase IP tracking data from wallet_events
        let ipTrackingData = {
            uniqueVisitors: 0,
            totalEvents: 0,
            topCountries: [] as { country: string; count: number }[],
            recentEvents: [] as { ip: string; event: string; wallet?: string; timestamp: string }[],
            conversionFunnel: {
                generate_attempts: 0,
                wallets_generated: 0,
                wallets_funded: 0,
                purchase_attempts: 0,
                purchases_completed: 0,
                flows_completed: 0,
                errors_by_stage: {} as Record<string, number>
            }
        };

        try {
            // Get all events from wallet_events
            const { data: eventData, error } = await supabase
                .from('wallet_events')
                .select('ip_address, event_type, metadata, created_at')
                .order('created_at', { ascending: false })
                .limit(500);

            if (!error && eventData) {
                const uniqueIpSet = new Set(eventData.map(d => d.ip_address));
                ipTrackingData.uniqueVisitors = uniqueIpSet.size;
                ipTrackingData.totalEvents = eventData.length;
                
                // Count events by type for conversion funnel
                eventData.forEach(d => {
                    // Check if it's an error event
                    if (d.metadata?.success === false) {
                        const stage = d.event_type;
                        ipTrackingData.conversionFunnel.errors_by_stage[stage] = 
                            (ipTrackingData.conversionFunnel.errors_by_stage[stage] || 0) + 1;
                    } else {
                        // Count successful events
                        switch(d.event_type) {
                            case 'generate_account_attempt':
                                ipTrackingData.conversionFunnel.generate_attempts++;
                                break;
                            case 'wallet_generated':
                                ipTrackingData.conversionFunnel.wallets_generated++;
                                break;
                            case 'wallet_funded':
                                ipTrackingData.conversionFunnel.wallets_funded++;
                                break;
                            case 'purchase_attempt':
                                ipTrackingData.conversionFunnel.purchase_attempts++;
                                break;
                            case 'purchase_completed':
                                ipTrackingData.conversionFunnel.purchases_completed++;
                                break;
                            case 'flow_completed':
                                ipTrackingData.conversionFunnel.flows_completed++;
                                break;
                        }
                    }
                });
                
                // Count by country from metadata
                const countryCount: { [key: string]: number } = {};
                eventData.forEach(d => {
                    const country = d.metadata?.geo?.country;
                    if (country) {
                        countryCount[country] = (countryCount[country] || 0) + 1;
                    }
                });
                
                ipTrackingData.topCountries = Object.entries(countryCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([country, count]) => ({ country, count }));
                    
                // Recent events with more details
                ipTrackingData.recentEvents = eventData.slice(0, 10).map(d => ({
                    ip: d.ip_address,
                    event: d.event_type,
                    wallet: d.metadata?.wallet_address,
                    timestamp: d.created_at
                }));
            }
        } catch (supabaseError) {
            console.log('Supabase data not available:', supabaseError);
        }

        // Parse recent wallets
        const parsedRecentWallets = recentWallets?.map((w: any) => {
            try {
                return typeof w === 'string' ? JSON.parse(w) : w;
            } catch {
                return null;
            }
        }).filter(Boolean) || [];

        // Calculate revenue metrics
        const totalRevenue = Number(totalPurchases) * Number(giftcardPrice) / 1e6; // Convert to USDC
        const averageRevenuePerWallet = totalWalletsGenerated ? totalRevenue / Number(totalWalletsGenerated) : 0;

        return NextResponse.json({
            blockchain: {
                totalGiftcardsSold: totalPurchases.toString(),
                giftcardPrice: (Number(giftcardPrice) / 1e6).toFixed(2) + ' USDC',
                totalRevenue: totalRevenue.toFixed(2) + ' USDC',
                storeBalance: (Number(storeBalance) / 1e6).toFixed(2) + ' USDC',
                bandBalance: (Number(bandBalance) / 1e6).toFixed(2) + ' USDC',
            },
            wallets: {
                totalGenerated: totalWalletsGenerated || 0,
                currentIndex: walletIndex || 0,
                uniqueIpsFromGeneration: uniqueIps || 0,
                averageRevenuePerWallet: averageRevenuePerWallet.toFixed(4) + ' USDC',
                recentWallets: parsedRecentWallets
            },
            traffic: ipTrackingData,
            contracts: {
                store: STORE_CONTRACT,
                band: BAND_CONTRACT,
                usdc: USDC_ADDRESS
            },
            timestamp: new Date().toISOString()
        }, { headers });
    } catch (err: any) {
        console.error('Analytics error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to fetch analytics' },
            { status: 500, headers }
        );
    }
}