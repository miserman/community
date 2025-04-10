#' Create a website
#'
#' Create a repository for a static website for data documentation and exploration.
#'
#' @param dir Directory in which to create the site's structure. Will be created if it does not exist.
#' @param title Title of the site.
#' @param template Name of a template to use, which are pre-constructed \code{site.R} and \code{build.R}
#' files. If \code{FALSE} or not found, no such files will be made.
#' @param with_data Logical; if \code{TRUE}, a data sub-directory and datapackage will be created.
#' @param node_project Logical; if \code{TRUE}, includes files used to run the site from a Node.js server.
#' @param include_api Logical; if \code{TRUE}, will make a \code{netlify.toml} config file to specify the
#' function directory for the API function, if included by \code{\link{site_build}}.
#' @param overwrite Logical; if \code{TRUE}, will overwrite existing site files in \code{dir}.
#' @param quiet Logical; if \code{TRUE}, suppresses messages and does not navigate to the file when finished.
#' @examples
#' \dontrun{
#' # initialize site in the current working directory
#' init_site(".")
#' }
#' @return Path to the created site directory.
#' @export

init_site <- function(dir, title = "app", template = "mtcars", with_data = FALSE, node_project = FALSE,
                      include_api = FALSE, overwrite = FALSE, quiet = !interactive()) {
  if (missing(dir)) cli_abort('{.arg dir} must be speficied (e.g., dir = ".")')
  check <- check_template("site", dir = dir)
  if (!quiet && check$exists && !overwrite) {
    cli_bullets(c(`!` = "site files already exist", i = "add {.code overwrite = TRUE} to overwrite them"))
  }
  dir <- normalizePath(paste0(dir, "/", check$spec$dir), "/", FALSE)
  dir.create(dir, FALSE, TRUE)
  dir <- normalizePath(dir, "/", FALSE)
  paths <- paste0(dir, "/", c(
    "README.md", "site.R", "package.json", "server.js", ".gitignore", "build.R",
    "project.Rproj", "netlify.toml"
  ))
  if (overwrite) unlink(paths, TRUE)
  if (!file.exists(paths[1])) {
    writeLines(c(
      paste("#", title),
      "<template: Describe the site>",
      "\n## Run",
      "```R",
      '# remotes::install_github("miserman/community")',
      "library(community)",
      "\n# from the site directory:",
      'site_build(".")',
      "```"
    ), paths[1])
  }
  template <- paste0(path.package("community"), c("/inst", ""), "/templates/", template, "/")
  template <- template[which(file.exists(template))[1]]
  if (!is.na(template)) {
    if (!file.exists(paths[2])) file.copy(paste0(template, "site.R"), paths[2])
    if (!file.exists(paths[6])) file.copy(paste0(template, "build.R"), paths[6])
  }
  if (node_project && !file.exists(paths[3])) {
    jsonlite::write_json(list(
      name = gsub("\\s+", "_", tolower(title)),
      version = "1.0.0",
      description = "",
      main = "server.js",
      directories = list(doc = "docs"),
      scripts = list(start = "node server.js"),
      dependencies = list(express = "latest"),
      author = "",
      license = "ISC"
    ), paths[3], auto_unbox = TRUE, pretty = TRUE)
  }
  if (node_project && !file.exists(paths[4])) {
    writeLines(c(
      "'use strict'",
      "const express = require('express'), app = express()",
      "app.use(express.static('docs'))",
      "app.listen(3000, function () {",
      "  console.log('listening on port 3000')",
      "})"
    ), paths[4])
  }
  if (!file.exists(paths[5])) {
    writeLines(c(
      ".Rproj.user",
      ".Rhistory",
      ".Rdata",
      ".httr-oauth",
      ".DS_Store",
      ".netlify",
      "*.Rproj",
      "node_modules",
      "package-lock.json",
      "docs/dist"
    ), paths[5])
  }
  if (!file.exists(paths[7]) && !any(grepl("\\.Rproj$", list.files(dir)))) writeLines("Version: 1.0\n", paths[7])
  if (include_api && !file.exists(paths[8])) {
    writeLines(c(
      "[build]",
      "  publish = 'docs'",
      "[[redirects]]",
      "  from = '/api'",
      "  to = '/.netlify/functions/api'",
      "  status = 200",
      "[functions]",
      "  directory = 'docs/functions'"
    ), paths[8])
  }
  dir.create(paste0(dir, "/docs"), FALSE)
  dir.create(paste0(dir, "/docs/functions"), FALSE)
  docs <- grep("/docs/", check$files, fixed = TRUE, value = TRUE)
  if (any(!file.exists(docs))) file.create(docs[!file.exists(docs)])
  if (with_data && !file.exists(paste0(dir, "/docs/data/datapackage.json"))) {
    dir.create(paste0(dir, "/docs/data"), FALSE)
    init_data(title, dir = paste0(dir, "/docs/data"), quiet = TRUE)
  }
  if (!quiet) {
    cli_bullets(c(
      v = "created a site skeleton for {title}:",
      "*" = paste0("{.path ", normalizePath(dir, "/", FALSE), "}")
    ))
    if (file.exists(paths[2])) navigateToFile(paths[2])
  }
  invisible(dir)
}
