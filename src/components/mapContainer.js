import React, { Component } from 'react';
import PropTypes from 'prop-types';

import MetaData from './metaData';
import Previewer from './previewer';
import DataService from '../utility/dataService';
import colBrewer from './data/colorBrewer.json';


const defaultRendererUri = 'http://localhost:23300';



class MapContainer extends Component {


    // rawData: initial data from handsontable output
    // parseData: output from parse endpoint
    // previewHtml: output from parse endpoint

    constructor(props) {
        super(props);

        // props.data holds the json used to define the table.
        // props.onSave holds the function that should be invoked to save the json
        // props.onCancel holds the function that should be invoked if the cancel button is clicked
        // props.onError holds the function that should be invoked in response to an error - pass in a message for the user
        // props.rendererUri holds the uri of the renderer

        

        let colBrewerNames = [];
        for (var key in colBrewer) {
            colBrewerNames.push(key)
        }

        this.state = {
            view: 'editTable',
            rendererUri: props.rendererUri ? props.rendererUri : defaultRendererUri,
            parsedData: '',
            rawData: '',
            metaTitle: '',
            metaSubtitle: '',
            metaUnits: '',
            metaSource: '',
            metaNotes: '',
            metaSizeunits: 'auto',
            isDirty:false,
            metaFormHide:false,
            file:{},
            topoJson:[],
            selectTopoJson:'',
            csv:'',
            rawTopoJsonData:{}, // 
            analyzeRenderResponse:{}, // response from analyzerequest
            analyzeRenderMessages:[],
            colBreaks:[],
            currentActiveTab:'metaData',
            selectedColBreaksIndex:-1,
            best_fit_class_count:-1,
            geography:{},
            colBrewerNames:colBrewerNames,
            colBrewerResource:colBrewer,
            selectedColBrewer:'',
            rgbBreakVals:[]
        };
        

        //callback handlers
        this.setMetaDataCallbk = this.setMetaData.bind(this);
        this.setMetaDataHide = this.setMetaDataHide.bind(this);
        this.changeview = this.changeView.bind(this);
        
        this.setDataDirty = this.setDataDirty.bind(this);

        this.onAnalyze = this.onAnalyze.bind(this);
        this.onPreviewMap = this.onPreviewMap.bind(this);
        // this.onBackFromPreview = this.onBackFromPreview.bind(this);
        this.cancel = this.cancel.bind(this);
        this.onError = this.onError.bind(this);    
    }



    componentDidMount() {
        if (this.props.data && !(Object.keys(this.props.data).length === 0))
        {
            this.populateMetaForm(this.props.data);
        }
    }




    // onBackFromPreview() {
    //     this.changeView('editTable');
    // }



    populateMetaForm(rebuildData){
        this.setState({
            metaTitle:rebuildData.title,
            metaSubtitle:rebuildData.subtitle,
            metaNotes: this.getFootNotes(rebuildData.footnotes),
            metaSource:rebuildData.source,
            metaSizeunits: rebuildData.cell_size_units || 'auto',
        })

     
    }

    changeView(viewType) {
        this.setState({
            view: viewType
        })
    }


    setDataDirty(dirtyFlag) {
        this.setState({isDirty:dirtyFlag});
        this.setState({statusMessage:''});
    }


    setMetaData(metaObject) {
        this.setState(metaObject);
        this.setDataDirty(true);
    }

   

    setMetaDataHide() {
        this.setState({metaFormHide:!this.state.metaFormHide})
    }
   


    cancel() {
        if (this.props.onCancel) {
            this.props.onCancel();
        }
    }



    onPreviewMap() {
        console.log('preview map clicked');
        const prom =  this.submitToRequestRender(this.buildRequestJson());
        prom.then((previewData) => {   
            this.setDataDirty(false); 
        })
    }



    onAnalyze() {
        const prom = this.getRawTopoJsonData(this.getTopoJsonObject());
        prom.then( ()=> {
            this.submitToAnalyzeRender(this.buildAnalyseJson());
        });
    }


    
    // build json for request endpoint
    buildRequestJson() {
        let renderObj = {};

        //get metatitle etc.
        renderObj.title = this.state.metaTitle;
        renderObj.subtitle = this.state.metaSubtitle;
        renderObj.source = this.state.metaSource;
        renderObj.source_link = this.state.metaSourceLink;
        renderObj.width = 400;
        renderObj.map_type = "choropleth";
        renderObj.license = this.state.metaLicense
        renderObj.filename="xxx";
        renderObj.footnotes = this.addFootNotes();
       

        // geography
        //renderObj.geography = this.state.geography;
        renderObj.geography = {
            "id_property":"AREACD",
            "name_property":"AREANM",
            "topojson":this.state.rawTopoJsonData
        }

        renderObj.data = this.state.analyzeRenderResponse.data;

        renderObj.choropleth = {
            "reference_value": 13,
            "reference_value_text": "UK",
            "breaks": this.state.rgbBreakVals,
            "missing_value_color": "LightGrey",
            "value_prefix": "",
            "value_suffix": "% non-UK born",
            "horizontal_legend_position": "before",
            "vertical_legend_position": "after"
        }
       
        return renderObj;
    }

    // build/ format Json  to analyze endpoint requirements
    buildAnalyseJson() {
        let analyseObj = {};
        analyseObj.geography = {
            "id_property":this.state.metaCsvkeysIdtxt,
            "name_property":this.state.metaCsvkeysValtxt,
            "topojson":this.state.rawTopoJsonData
        }
        
        analyseObj.csv = this.state.csv;
        analyseObj.id_index =  parseInt(this.state.metaCsvkeysId) || 0;
        analyseObj.value_index =parseInt(this.state.metaCsvkeysVal) || 0;
        analyseObj.has_header_row = true;
        console.log(analyseObj);
        this.setState({geography:analyseObj.geography});
        return analyseObj;
    }




    // gets actual TopoJson object data from state based on selection of boundary type
    getTopoJsonObject() {    
        const result = this.state.topoJson.filter(boundaryObj => boundaryObj.name ===this.state.selectTopoJson);
        return result[0].download_url;
    }

  

    // call the github endpoint stored in prop download_url
    getRawTopoJsonData(uri) {
        return new Promise((resolve, reject) => {
            const prm = DataService.getRawTopoJsonData(uri)
            prm.then((rawJson) => {   
                this.setState({"rawTopoJsonData":rawJson});
                resolve(rawJson);
            })
                .catch((e)=> {
                    console.log('getRawTopoJsonData error',e);
                    this.onError("No (or error) response from endpoint");
                
                })
        })
    }


    submitToAnalyzeRender(anaData) {
        const uri = "http://localhost:23500/analyse";
        const prm = DataService.analyzeMapRender(anaData,uri);
        prm.then((result) => {   
            console.log(result)
            this.setState({
                "analyzeRenderResponse":result, 
                analyzeRenderMessages: result.messages,
                colBreaks: result.breaks,
                best_fit_class_count: result.best_fit_class_count,
                selectedColBreaksIndex:this.lookupBestFitArray(result.best_fit_class_count,result.breaks),
                previewHtml:this.formatAnalyzeResponseMsg(result.messages)
            }) 
                    
        })
            .catch((e)=> {
                console.log('getRawTopoJsonData error',e);
                this.onError("No (or error) response from endpoint");
            })
    }




    submitToRequestRender(reqData) {
        return new Promise((resolve, reject) => {
        
            const uri = "http://localhost:23500/render/svg"
            const prm = DataService.requestMapRender(reqData,uri);
            prm.then((result) => {   
                console.log(result)
                this.setState({
                    previewHtml: result
                })

                resolve(result);
                    
            })
                .catch((e)=> {
                    console.log('request map render  error',e);
                    this.onError("No (or error) response from endpoint");
                })
        });
    }




    // find object in colbreaks array based on the value of best fit from request
    lookupBestFitArray(bestFit,colBreaksArr) {
        const rtnIndex = (colBreaksArr.findIndex(obj =>obj.length==bestFit));
        return rtnIndex
    }



    addFootNotes() {
        if (this.state.metaNotes === '')
            return null
        else {
            const notelist = this.state.metaNotes.split("\n");
            return notelist;
        }
    }

   
    
    // extract the Meta notes string from footnotes json
    // when loading an existing table
    getFootNotes(data) {
        return  data.toString().replace(",","\n",-1);       
    }





    // handle errors by invoking an onError method passed in to the constructor
    onError(message) {
        if (this.props.onError) {
            this.props.onError(message);
        } else {
            this.setState({statusMessage: message})
        }
    }
    

    formatAnalyzeResponseMsg(message) {
        let formattedMsg="";
        message.map( (msgObj)=>{
            formattedMsg+=msgObj.level + "<br/>" + msgObj.text + "<br/>"
        })
        return formattedMsg;
    }



    render() {
       
        let viewComponent= null;
       
        if (this.state.view === 'editTable') {
            viewComponent = 
                <div>
                    <MetaData
                        // setMetaDataCallbk={this.setMetaData.bind(this)}
                        setMetaData={this.setMetaDataCallbk}
                        setMetaDataHide={this.setMetaDataHide}
                        formHide={this.state.metaFormHide}
                        refreshGrid={this.onRefresh}
                        metaTitle={this.state.metaTitle}
                        metaSubtitle={this.state.metaSubtitle}
                        metaSource={this.state.metaSource}
                        metaNotes={this.state.metaNotes}
                        metaHeadercols={this.state.metaHeadercols}
                        metaHeaderrows={this.state.metaHeaderrows}
                        metaSizeunits={this.state.metaSizeunits}
                        topoJson ={this.state.topoJson}
                        selectedBoundary={this.state.selectedBoundary}
                        currentActiveTab = {this.state.currentActiveTab}
                        colBreaks = {this.state.colBreaks}
                        selectedColBreaksIndex = {this.state.selectedColBreaksIndex}
                        best_fit_class_count = {this.state.best_fit_class_count}
                        colBrewerNames = {this.state.colBrewerNames}
                        colBrewerResource = {this.state.colBrewerResource}
                        selectedColBrewer = {this.state.selectedColBrewer}
                        rgbBreakVals = {this.state.rgbBreakVals}

                    />
                    <div className="grid"> 
                        <Previewer previewHtml={this.state.previewHtml} />
                    </div>
                </div>;
        }
            
        // else {
        //     viewComponent = <Previewer previewHtml={this.state.previewHtml} />
        // }


        return (
            <div className="gridContainer">
                {viewComponent}
                <div className="statusBar">
                    <div className="statusBtnsGroup">
                        <button className="btn--positive" onClick={this.saveGrid} >save</button>&nbsp;
                        <button onClick={this.cancel}>cancel</button> &nbsp;
                        <button className={this.state.currentActiveTab === 'uploadData'? "showBtn": "hideBtn"} onClick={this.onAnalyze}>analyse request</button> &nbsp;
                        <button className={this.state.currentActiveTab === 'themeData'? "showBtn": "hideBtn"} onClick={this.onPreviewMap}>preview map</button> &nbsp;
                        <button className={this.state.view === 'editTable'? "hideBtn": "showBtn"} onClick={this.onBackFromPreview}>back</button> &nbsp;
                       
                    </div>
                </div>
            </div>
        );
           
    }

}


MapContainer.propTypes = {
    data: PropTypes.object,
    onSave: PropTypes.func,
    rendererUri:PropTypes.string
}

export default MapContainer;

