const regEx = (function(){
    const float = "\\d*\\.\\d+";
    const int = "\\d+\\.?";
    const variable = "[a-zA-Z]\\w*";
    const stuff = "[^()]*?(?:\\(.*?\\)[^()]*?)*?";
    const bracket = "\\(" + stuff + "\\)";
    const func = variable + bracket;

    const legal = "(" + [float, int, variable, bracket].join("|") + ")";

    function value(str){
        return new RegExp("^\\s*" + str + "\\s*$");
    }

    function operator(str){
        return new RegExp("^(" + stuff + ")(" + str + ")(" + stuff + ")$");
    }

    const input = "^(?:\\s*(" + variable + ")(" + bracket + ")?\\s*[=:→])?(.+)$";

    return {
        float: value(float),
        int: value(int),
        variable: value(variable),
        func: value(func),
        bracket: value("\\((" + stuff + ")\\)"),

        add: operator("[+-]"),
        mult: operator("(?!^)[*/]"),
        combinedMult: value(legal + legal + "+"),

        input: new RegExp(input),
        whitespace: /^\s*$/
    };
})();

const operators = {
    add: {
        enum: 1,
        symbols: {
            "+": "add",
            "-": "sub"
        }
    },

    mult: {
        enum: 2,
        symbols: {
            "*": "mult",
            "/": "div"
        }
    }
};

function Engine(){
    this._init.apply(this, arguments);
}

Engine.prototype = {
    _init: function(entry){
        this.entry = entry;
        this.res = entry.applet.res;
        this.reset();
    },

    reset: function(){
        this.entry.term = null;
        this.entry.deps = [];
        this.entry.type = "var";

        if(this.entry.func)
            delete this.entry.func;
    },

    set source(str){
        this.reset();
        this.term = this.parse(str);
    },

    parse: function(str){
        //if string is a bracket, parse the content of it
        let result = str.match(regEx.bracket);
        if(result)
            str = result[1];

        //if it is a number, return it as a number
        if(str.match(regEx.float))
            return parseFloat(str);
        if(str.match(regEx.int))
            return parseInt(str);

        //if it is a variable, return it as a string
        if(str.match(regEx.variable))
            return this.parseVariable(str);

        //loop through all operator types
        for(let operator in operators){
            let result = str.match(regEx[operator]);

            if(result)
                return this.parseOperator(operator, result[1], result[2], result[3]);
        }

        result = str.match(regEx.combinedMult);
        if(result)
            return this.parseCombinedMult(result[1], result[2]);

        throw "Token `" + str + "` could not be parsed.";
    },

    parseVariable: function(symbol){
        //trim whitespaces
        symbol = symbol.trim();

        //if it is x, it must be a function now
        if(symbol === "x")
            this.entry.type = "func";
        //add all other variable to the dependencies array
        else if(this.entry.deps.indexOf(symbol) === -1)
            this.entry.deps.push(symbol);

        return symbol;
    },

    parseOperator: function(operator, left, symbol, right){
        let obj = {
            type: operators[operator].enum
        };

        if(left)
            obj[operator] = [this.parse(left)];

        this.parseOperatorChain(obj, operator, symbol, right);
        return obj;
    },

    parseOperatorChain: function(obj, operator, symbol, right){
        function append(value){
            let key = operators[operator].symbols[symbol];

            if(obj[key] instanceof Array)
                obj[key].push(value);
            else
                obj[key] = [value];
        }

        let result = right.match(regEx[operator]);
        if(result){
            append(this.parse(result[1]));
            this.parseOperatorChain(obj, operator, result[2], result[3]);
        } else
            append(this.parse(right));
    },

    parseCombinedMult: function(left, right){
        return {
            type: operators.mult.enum,
            mult: [this.parse(left), this.parse(right)]
        };
    },

    get func(){
        let str = "return " + this.stringify(this.term) + ";";
        return Function.constructor.call(null, ["x", "vars"], str);
    },

    stringify: function(term, before){
        //number
        if(typeof term === "number")
            return term;

        //variable
        if(typeof term === "string"){
            if(term === "x")
                return "x";
            else
                return "vars." + term; //use the resources object
        }

        for(let operator in operators){
            operator = operators[operator];

            if(term.type === operator.enum)
                return this.stringifyOperator(term, operator, before);
        }

        throw "Could not turn term `" + JSON.stringify(term) + "` into a function string";
    },

    stringifyOperator: function(term, operator, before){
        let str = "";

        for(let symbol in operator.symbols){
            let name = operator.symbols[symbol];

            if(term[name]){
                term[name].forEach(function(term){
                    if(str)
                        str += symbol;

                    str += this.stringify(term, operator.enum);
                }, this);
            }
        }

        //if the rank of the current operation is lower than the operation before, add brackets
        if(before > term.type)
            str = "(" + str + ")";

        return str;
    },

    get result(){
        return this.calculate(this.term);
    },

    calculate: function(term){
        //no calculation to do on numbers
        if(typeof term === "number")
            return term;

        //look up for a variable
        if(typeof term === "string"){
            if(this.res.vars[term] !== undefined)
                return this.res.vars[term];

            throw "Variable or constant `%s` not found".format(obj);
        }

        if(term.type === operators.add.enum)
            return this.calculateAddOperation(term);
        else if(term.type === operators.mult.enum)
            return this.calculateMultOperation(term);

        throw "Could not calculate term `" + JSON.stringify(term) + "`";
    },

    calculateAddOperation: function(term){
        let result = 0;

        if(term.add){
            term.add.forEach(function(value){
                result += this.calculate(value);
            }, this);
        }

        if(term.sub){
            term.sub.forEach(function(value){
                result -= this.calculate(value);
            }, this);
        }

        return result;
    },

    calculateMultOperation: function(term){
        let result = 1;

        if(term.mult){
            term.mult.forEach(function(value){
                result *= this.calculate(value);
            }, this);
        }

        if(term.div){
            term.div.forEach(function(value){
                value = this.calculate(value);

                if(value === 0)
                    throw "Division with 0 is not defined";

                result /= value;
            }, this);
        }

        return result;
    }
};
