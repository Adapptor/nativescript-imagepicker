import { Options, ImagePickerMediaType } from "./imagepicker.common";
export * from "./imagepicker.common";

import {Observable, ImageAsset, View, Utils} from "@nativescript/core";

const defaultAssetCollectionSubtypes: NSArray<any> = NSArray.arrayWithArray(<any>[
    PHAssetCollectionSubtype.SmartAlbumRecentlyAdded,
    PHAssetCollectionSubtype.SmartAlbumUserLibrary,
    PHAssetCollectionSubtype.AlbumMyPhotoStream,
    PHAssetCollectionSubtype.SmartAlbumFavorites,
    PHAssetCollectionSubtype.SmartAlbumPanoramas,
    PHAssetCollectionSubtype.SmartAlbumBursts,
    PHAssetCollectionSubtype.AlbumCloudShared,
    PHAssetCollectionSubtype.SmartAlbumSelfPortraits,
    PHAssetCollectionSubtype.SmartAlbumScreenshots,
    PHAssetCollectionSubtype.SmartAlbumLivePhotos
]);

@NativeClass()
export class ImagePicker extends Observable {
    _imagePickerController: QBImagePickerController;
    _hostView: View;

    // lazy-load latest frame.topmost() if _hostName is not used
    get hostView() {
        return this._hostView;
    }

    get hostController(): UIViewController {
        let vc = this.hostView ? this.hostView.viewController : UIApplication.sharedApplication.keyWindow.rootViewController;
        while (
            vc.presentedViewController
            && vc.presentedViewController.viewLoaded
            && vc.presentedViewController.view.window
        ) {
            vc = vc.presentedViewController;
        }
        return vc;
    }

    constructor(options: Options = {}, hostView: View) {
        super();

        this._hostView = hostView;

        let imagePickerController = QBImagePickerController.alloc().init();

        imagePickerController.assetCollectionSubtypes = defaultAssetCollectionSubtypes;
        imagePickerController.mediaType = options.mediaType ? <QBImagePickerMediaType>options.mediaType.valueOf() : QBImagePickerMediaType.Any;
        imagePickerController.allowsMultipleSelection = options.mode !== 'single';
        imagePickerController.minimumNumberOfSelection = options.minimumNumberOfSelection || 0;
        imagePickerController.maximumNumberOfSelection = options.maximumNumberOfSelection || 0;
        imagePickerController.showsNumberOfSelectedAssets = options.showsNumberOfSelectedAssets || true;
        imagePickerController.numberOfColumnsInPortrait = options.numberOfColumnsInPortrait || imagePickerController.numberOfColumnsInPortrait;
        imagePickerController.numberOfColumnsInLandscape = options.numberOfColumnsInLandscape || imagePickerController.numberOfColumnsInLandscape;
        imagePickerController.prompt = options.prompt || imagePickerController.prompt;

        this._imagePickerController = imagePickerController;
    }

    authorize(): Promise<void> {
        console.log("authorizing...");

        return new Promise<void>((resolve, reject) => {
            let runloop = CFRunLoopGetCurrent();
            PHPhotoLibrary.requestAuthorization(function (result) {
                if (result === PHAuthorizationStatus.Authorized) {
                    resolve();
                } else {
                    reject(new Error("Authorization failed. Status: " + result));
                }
            });
        });
    }

    present() {
        return new Promise<void>((resolve, reject) => {
            const imagePickerControllerDelegate = ImagePickerControllerDelegate.new();
            imagePickerControllerDelegate._resolve = resolve;
            imagePickerControllerDelegate._reject = reject;

            this._imagePickerController.delegate = imagePickerControllerDelegate;

            this.hostController.presentViewControllerAnimatedCompletion(this._imagePickerController, true, null);
        });
    }
}

@NativeClass()
export class ImagePickerControllerDelegate extends NSObject implements QBImagePickerControllerDelegate {
    _resolve: any;
    _reject: any;

    qb_imagePickerControllerDidCancel?(imagePickerController: QBImagePickerController): void {
        imagePickerController.dismissViewControllerAnimatedCompletion(true, null);
        this._reject(new Error("Selection canceled."));

        this.deRegisterFromGlobal();
    }

    qb_imagePickerControllerDidFinishPickingAssets?(imagePickerController: QBImagePickerController, iosAssets: NSArray<any>): void {
        let assets = [];

        for (let i = 0; i < iosAssets.count; i++) {
            let asset = new ImageAsset(iosAssets[i]);

            if (!asset.options) {
                asset.options = { keepAspectRatio: true };
            }

            assets.push(asset);
        }

        this._resolve(assets);

        imagePickerController.dismissViewControllerAnimatedCompletion(true, () => {
            this.deRegisterFromGlobal();
            // FIX: possible memory issue when picking images many times.
            // Not the best solution, but the only one working for now
            // https://github.com/NativeScript/nativescript-imagepicker/issues/222
            setTimeout(Utils.GC, 200);
        });

    }

    // FIX: stores a reference to global scope, so that the delegate is not collected in native
    // https://github.com/NativeScript/nativescript-imagepicker/issues/251
    private registerToGlobal(): any {
        (<any>global).imagePickerControllerDelegate = this;
    }

    private deRegisterFromGlobal(): any {
        (<any>global).imagePickerControllerDelegate = null;
    }

    public static ObjCProtocols = [QBImagePickerControllerDelegate];

    static new(): ImagePickerControllerDelegate {
        const instance = <ImagePickerControllerDelegate>super.new(); // calls new() on the NSObject

        instance.registerToGlobal();

        return instance;
    }
}

export function create(options?: Options, hostView?: View): ImagePicker {
    return new ImagePicker(options, hostView);
}
