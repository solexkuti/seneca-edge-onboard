# Seneca Edge

Seneca Edge is a trading journal,replay and backtesting platform designed to help traders simulate real market conditions and improve execution discipline.
Built for serious traders focused on discipline, execution, and performance.

## Core Features

### Replay Engine
- Step-by-step candle playback
- Adjustable speed (0.5x – 4x)
- Historical session simulation
- Precise bar-by-bar market reconstruction

### Trade Simulator
- Market Buy / Sell execution
- Stop Loss & Take Profit handling
- Risk-based position sizing (%)
- Real-time trade tracking and outcomes

### Data Integration
- Synthetic indices via Deriv API
- Forex market data integration (in progress)
- Structured asset grouping (Synthetic / Forex)

### Performance Analytics
- Equity tracking
- Win rate calculation
- R-multiple tracking
- Trade history review

## Decision & Behavior Tools

### Trade Journal
- Structured journaling system for recording trades
- Post-trade reflection and mistake tracking
- Pattern recognition across trading behavior

### AI Mentor (in development)
- Provides feedback on trading decisions
- Identifies behavioral patterns and execution errors
- Reinforces disciplined decision-making

## Architecture

- Chart Engine: TradingView Advanced Charts (pending integration)- Data Source: Deriv API (WebSocket)
- Backend: Supabase
- Replay Engine: Custom-built candle streaming system

## Vision

To build a TradingView-level charting and execution environment focused on:
- clarity
- discipline
- realistic simulation

## Status

Actively under development — core replay and execution systems in progress.
