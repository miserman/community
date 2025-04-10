#' Download Dataverse Dataset Files
#'
#' Download one or all files in a Dataverse dataset.
#'
#' @param id The dataset's persistent ID (e.g., \code{"doi:10.18130/V3/SWK71R"}), or a GitHub repository
#' (\code{"username/repo"}) with a \code{R/sysdata.rda} file containing a \code{dataset_doi}.
#' @param outdir Directory in which to save files; defaults to a temporary directory.
#' @param files Names (full or partial) of files to download, or a number or vector of numbers
#' identifying file by index as listed on Dataverse; downloads all files in a dataset if not specified.
#' @param version Version of the dataset to download. Specifying this will download all files,
#' even if only a selection is requested.
#' @param server Dataverse server; tries to get this from the DOI redirect, but falls back on
#' \code{Sys.getenv("DATAVERSE_SERVER")}, then \code{getOption("dataverse.server")}, then
#' \code{"dataverse.lib.virginia.edu"}.
#' @param key Dataverse API key; only needed if the requested dataset is not published. If not specified,
#' looks for the key in \code{Sys.getenv("DATAVERSE_KEY")} and \code{getOption("dataverse.key")}.
#' @param load Logical; if \code{FALSE}, files will be downloaded but not loaded.
#' @param decompress Logical; if \code{TRUE}, will attempt to decompress compressed files.
#' @param refresh Logical; if \code{TRUE}, downloads and replaces any existing files.
#' @param branch Name of the repository branch, if \code{id} is the name of a repository; uses the default branch
#' if not specified.
#' @param verbose Logical; if \code{TRUE}, prints status updates and warnings.
#' @examples
#' \dontrun{
#' metadata <- download_dataverse_info("doi:10.18130/V3/SWK71R", verbose = TRUE)
#' data <- download_dataverse_data("doi:10.18130/V3/SWK71R", verbose = TRUE)
#' }
#' @return \code{download_dataverse_data}: If \code{load} is \code{TRUE}, an invisible list with
#' an entry for each data file if there are multiple files, or the loaded data file if a single file
#' is requested. Tabular data files are loaded as \code{data.table}s. If \code{load} is \code{FALSE},
#' a list with the dataset's metadata.
#' @export

download_dataverse_data <- function(id, outdir = tempdir(), files = NULL, version = ":latest",
                                    server = NULL, key = NULL, load = TRUE, decompress = FALSE,
                                    refresh = FALSE, branch = NULL, verbose = FALSE) {
  if (missing(id)) cli_abort("{.arg id} must be specified")
  if (!is.character(outdir)) cli_abort("{.arg outdir} must be a character")
  meta <- download_dataverse_info(id, server = server, key = key, refresh = refresh, branch = branch)
  fs <- vapply(meta$files, function(m) m$dataFile$filename, "")
  which_files <- if (!is.null(files)) {
    if (is.numeric(files)) {
      files[files <= length(fs)]
    } else {
      grep(paste0(
        "(?:", paste(gsub(".", "\\.", files, fixed = TRUE), collapse = "|"), ")"
      ), fs, TRUE)
    }
  } else {
    seq_along(fs)
  }
  if (!length(which_files)) {
    cli_abort(cli_bullets(c(
      x = "{.arg files} could not be matched to available files",
      i = paste0("check {.url ", meta$persistentUrl, "}")
    )))
  }
  outdir <- paste0(normalizePath(outdir, "/", FALSE), "/")
  dir.create(outdir, FALSE, TRUE)
  data <- list()
  ffsx <- paste0(outdir, fs)
  ffs <- sub("\\.[gbx]z2?$", "", ffsx)
  if (refresh) unlink(c(ffsx, ffs))
  if (is.null(key)) {
    if (verbose) cli_alert_info("looking for API key in fall-backs")
    key <- Sys.getenv("DATAVERSE_KEY")
    if (key == "") {
      key <- getOption("dataverse.key")
    }
  }
  if (length(which_files) == length(fs) || !missing(version)) {
    zf <- paste0(outdir, gsub("\\W", "", meta$datasetPersistentId), ".zip")
    if (verbose) cli_alert_info("downloading dataset: {meta$datasetPersistentId}")
    if (is.character(key)) {
      if (verbose) cli_alert_info("trying with key")
      tryCatch(
        system2("curl", c(
          paste0("-H X-Dataverse-key:", key),
          "-o", zf,
          paste0(
            meta$server, "api/access/dataset/:persistentId/versions/", version, "?persistentId=",
            meta$datasetPersistentId
          )
        ), stdout = TRUE),
        error = function(e) NULL
      )
    } else {
      if (verbose) cli_alert_info("trying without key")
      tryCatch(
        download.file(paste0(
          meta$server, "api/access/dataset/:persistentId/versions/", version, "?persistentId=",
          meta$datasetPersistentId
        ), zf, quiet = TRUE, mode = "wb"),
        error = function(e) NULL
      )
    }
    if (file.exists(zf)) {
      unzip(zf, exdir = sub("/$", "", outdir))
      unlink(zf)
    } else if (verbose) cli_alert_info("failed to download dataset {meta$id}; trying individual files...")
  }
  for (i in which_files) {
    m <- meta$files[[i]]
    meta$files[[i]]$local <- ffs[i]
    if (!file.exists(ffs[i]) && !file.exists(ffsx[i])) {
      if (verbose) cli_alert_info("downloading file: {.file {m$label}}")
      if (is.null(key)) {
        if (verbose) cli_alert_info("trying without key")
        tryCatch(
          download.file(
            paste0(meta$server, "api/access/datafile/", m$dataFile$id), ffsx[i],
            quiet = TRUE, mode = "wb"
          ),
          error = function(e) NULL
        )
      } else {
        if (verbose) cli_alert_info("trying with key")
        tryCatch(
          system2("curl", c(
            paste0("-H X-Dataverse-key:", key),
            "-o", ffsx[i],
            paste0(meta$server, "api/access/datafile/", m$dataFile$id)
          ), stdout = TRUE),
          error = function(e) NULL
        )
      }
      if (verbose && !file.exists(ffsx[i])) cli_alert_info("failed to download file: {.file {m$label}}")
    }
    if (file.exists(ffsx[i])) {
      if (verbose && m$dataFile$md5 != md5sum(ffsx[i])) {
        cli_warn("file was downloaded but its checksum did not match: {.file {ffsx[i]}}")
      }
      if (decompress && grepl("[gbx]z2?$", ffsx[i])) {
        if (verbose) cli_alert_info("decompressing file: {.file {ffsx[i]}}")
        system2(
          c(xz = "xz", bz = "bunzip2", gz = "gzip")[substring(ffsx[i], nchar(ffsx[i]) - 1)],
          c("-df", shQuote(ffsx[i]))
        )
      }
    }
    if (load && file.exists(if (decompress) ffs[i] else ffsx[i])) {
      if (verbose) cli_alert_info("loading file: {.file {ffs[i]}}")
      fn <- sub("\\..*", "", m$label)
      json <- grepl("\\.json$", ffs[i])
      data[[fn]] <- tryCatch(
        if (json) {
          jsonlite::read_json(ffs[i], simplifyVector = TRUE)
        } else {
          read_delim_arrow(gzfile(ffsx[i]), if (grepl("csv", format, fixed = TRUE)) "," else "\t")
        },
        error = function(e) NULL
      )
      if (verbose && is.null(data[[fn]])) {
        cli_warn("file was downloaded but failed to load: {.file {ffs[i]}}")
      }
    }
  }
  if (!decompress) ffs <- ffsx
  ffs <- ffs[which_files]
  if (verbose && any(!file.exists(ffs))) {
    cli_warn("failed to download file{?s}: {.file {ffs[!file.exists(ffs)]}}")
  }
  invisible(if (load) if (length(data) == 1) data[[1]] else data else meta)
}
