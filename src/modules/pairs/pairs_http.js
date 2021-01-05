const _ = require('lodash');

module.exports = class PairsHttp {
  constructor(instances, exchangeManager, pairStateManager, eventEmitter) {
    this.instances = instances;
    this.exchangeManager = exchangeManager;
    this.pairStateManager = pairStateManager;
    this.eventEmitter = eventEmitter;
  }

  async getTradePairs() {
    const pairs = await Promise.all(
      this.instances.symbols.map(async symbol => {
        const position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol);
        const state = await this.pairStateManager.get(symbol.exchange, symbol.symbol);

        const strategiesTrade = symbol.trade && symbol.trade.strategies ? symbol.trade.strategies : [];

        const item = {
          exchange: symbol.exchange,
          symbol: symbol.symbol,
          watchdogs: symbol.watchdogs,
          is_trading: strategiesTrade.length > 0,
          has_position: position !== undefined,
          trade_capital: _.get(symbol, 'trade.capital', 0),
          trade_currency_capital: _.get(symbol, 'trade.currency_capital', 0),
          strategies: symbol.strategies || [],
          strategies_trade: strategiesTrade,
          weight: 0
        };

        // open position wins over default state
        if (item.has_position) {
          item.weight += 1;
        }

        // processing items must win
        if (state && state.state) {
          item.process = state.state;
          item.weight += 2;
        }

        return item;
      })
    );

    return pairs
      .sort((a, b) => `${a.exchange}.${a.symbol}`.localeCompare(`${b.exchange}.${b.symbol}`))
      .sort((a, b) => b.weight - a.weight);
  }

  async triggerOrder(exchangeName, symbol, action) {
    let side = action;
    const options = {};
    if (['long_market', 'short_market', 'close_market'].includes(action)) {
      options.market = true;
      side = side.replace('_market', '');
    }

    this.pairStateManager.update(exchangeName, symbol, side, options);

    this.eventEmitter.emit('tick_ordering');
  }
};
